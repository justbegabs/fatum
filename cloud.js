import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  arrayRemove,
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  initializeFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const fatum = window.fatumApp;
const useEmulator = new URLSearchParams(location.search).has("emulator");
const config = useEmulator
  ? { apiKey: "demo-key", authDomain: "demo-fatum.firebaseapp.com", projectId: "demo-fatum", appId: "demo-app" }
  : firebaseConfig;

const CAMPAIGN_FIELDS = ["name", "description", "masterName", "defaultDt", "createdAt"];
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LEAVE = Symbol("leave");

let db;
let auth;
let user = null;
let ready = false;
let campaignsLoaded = false;
let personalLoaded = false;
let stopCampaigns = null;
let stopPersonal = null;
let flushTimer = null;
let flushing = null;
let selectAfterJoin = null;
let ui = { activeCampaignId: null, activeCharacterIds: {} };
const campaignListeners = new Map();
const serverDocs = new Map();
const pending = new Map();

const campaignPath = (campaignId) => `campaigns/${campaignId}`;
const isCampaignPath = (path) => path.split("/").length === 2;
const campaignIdOf = (path) => path.split("/")[1];
const personalPrefix = () => `users/${user.uid}/characters/`;
const uiKey = () => `fatum-ordem2-cloud-ui-${user.uid}`;

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function createInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join("");
}

function pick(data, keys) {
  return Object.fromEntries(keys.filter((key) => data[key] !== undefined).map((key) => [key, data[key]]));
}

function view(path) {
  if (!pending.has(path)) return serverDocs.get(path);
  const data = pending.get(path);
  return data === LEAVE || data === null ? undefined : data;
}

function viewEntries() {
  return [...new Set([...serverDocs.keys(), ...pending.keys()])]
    .map((path) => [path, view(path)])
    .filter(([, data]) => data);
}

function isOwnCampaign(campaignId) {
  return view(campaignPath(campaignId))?.ownerUid === user.uid;
}

function charactersUnder(entries, prefix) {
  return entries
    .filter(([childPath]) => childPath.startsWith(prefix))
    .sort(([, a], [, b]) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")))
    .map(([childPath, child]) => ({ ...child, id: childPath.slice(prefix.length) }));
}

function buildStore() {
  const entries = viewEntries();
  const campaigns = entries.filter(([path]) => isCampaignPath(path)).map(([path, data]) => {
    const id = campaignIdOf(path);
    const characters = charactersUnder(entries, `${path}/characters/`);
    const campaign = fatum.normalizeCampaign({
      ...data,
      id,
      characters,
      master: view(`${path}/private/master`) ?? {},
      activeCharacterId: ui.activeCharacterIds[id]
    });
    campaign.role = data.ownerUid === user.uid ? "master" : "player";
    campaign.inviteCode = data.ownerUid === user.uid ? data.inviteCode ?? "" : "";
    return campaign;
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const personal = fatum.createPersonalSpace(charactersUnder(entries, personalPrefix()), ui.activeCharacterIds[fatum.PERSONAL_ID]);
  personal.role = "personal";
  const all = [personal, ...campaigns];
  const activeCampaignId = all.some(({ id }) => id === ui.activeCampaignId) ? ui.activeCampaignId : campaigns[0]?.id ?? personal.id;
  return { activeCampaignId, campaigns: all };
}

function setStatus(message, failed = false) {
  fatum.setSaveStatus(message, failed);
}

function publish() {
  if (!ready) return;
  const nextStore = buildStore();
  if (!ui.migrationOffered && nextStore.campaigns.length === 1 && !nextStore.campaigns[0].characters.length) {
    offerLocalUpload();
    return;
  }
  fatum.applyCloudStore(nextStore);
  if (selectAfterJoin && nextStore.campaigns.some(({ id }) => id === selectAfterJoin)) {
    fatum.selectCampaign(selectAfterJoin);
    selectAfterJoin = null;
  }
}

function checkReady() {
  if (ready || !campaignsLoaded || !personalLoaded) return;
  if ([...campaignListeners.values()].some((listener) => listener.waiting > 0)) return;
  ready = true;
}

function update() {
  checkReady();
  publish();
}

function offerLocalUpload() {
  ui.migrationOffered = true;
  storeUi();
  const local = fatum.getLocalCampaigns();
  const personalCharacters = local.find(({ id }) => id === fatum.PERSONAL_ID)?.characters ?? [];
  const campaigns = local.filter(({ id }) => id !== fatum.PERSONAL_ID);
  const parts = [
    campaigns.length && (campaigns.length === 1 ? "1 campanha" : `${campaigns.length} campanhas`),
    personalCharacters.length && (personalCharacters.length === 1 ? "1 personagem sem campanha" : `${personalCharacters.length} personagens sem campanha`)
  ].filter(Boolean);
  if (parts.length && confirm(`Você tem ${parts.join(" e ")} neste navegador. Enviar para a sua conta Google?`)) {
    const uploaded = campaigns.map((campaign) => ({ ...campaign, id: fatum.createId("campaign") }));
    const activeCampaignId = uploaded[0]?.id ?? fatum.PERSONAL_ID;
    ui.activeCampaignId = activeCampaignId;
    save({ activeCampaignId, campaigns: [fatum.createPersonalSpace(personalCharacters), ...uploaded] });
  }
  publish();
}

function purgeCampaign(campaignId) {
  const path = campaignPath(campaignId);
  [...serverDocs.keys()].forEach((key) => {
    if (key === path || key.startsWith(`${path}/`)) serverDocs.delete(key);
  });
}

function listenerError(campaignId, listener, error) {
  console.error("Falha ao sincronizar com a nuvem.", error);
  listener.waiting = 0;
  listener.stops.forEach((stop) => stop());
  if (campaignListeners.get(campaignId) === listener) campaignListeners.delete(campaignId);
  update();
}

function subscribeCampaign(campaignId, data) {
  const path = campaignPath(campaignId);
  const master = data.ownerUid === user.uid;
  const listener = { stops: [], waiting: master ? 2 : 1 };
  campaignListeners.set(campaignId, listener);
  const characters = collection(db, path, "characters");
  const charactersQuery = master ? characters : query(characters, where("ownerUid", "==", user.uid));
  let charactersLoaded = false;
  listener.stops.push(onSnapshot(charactersQuery, (snapshot) => {
    const prefix = `${path}/characters/`;
    [...serverDocs.keys()].forEach((key) => {
      if (key.startsWith(prefix)) serverDocs.delete(key);
    });
    snapshot.docs.forEach((entry) => serverDocs.set(`${prefix}${entry.id}`, entry.data()));
    if (!charactersLoaded) {
      charactersLoaded = true;
      listener.waiting -= 1;
    }
    update();
  }, (error) => listenerError(campaignId, listener, error)));
  if (!master) return;
  let masterLoaded = false;
  listener.stops.push(onSnapshot(doc(db, path, "private", "master"), (snapshot) => {
    if (snapshot.exists()) serverDocs.set(`${path}/private/master`, snapshot.data());
    else serverDocs.delete(`${path}/private/master`);
    if (!masterLoaded) {
      masterLoaded = true;
      listener.waiting -= 1;
    }
    update();
  }, (error) => listenerError(campaignId, listener, error)));
}

function unsubscribeCampaign(campaignId) {
  campaignListeners.get(campaignId)?.stops.forEach((stop) => stop());
  campaignListeners.delete(campaignId);
  purgeCampaign(campaignId);
}

function startSession() {
  try {
    ui = { activeCampaignId: null, activeCharacterIds: {}, ...JSON.parse(localStorage.getItem(uiKey()) ?? "{}") };
  } catch {
    ui = { activeCampaignId: null, activeCharacterIds: {} };
  }
  const campaignsQuery = query(collection(db, "campaigns"), where("memberUids", "array-contains", user.uid));
  stopPersonal = onSnapshot(collection(db, "users", user.uid, "characters"), (snapshot) => {
    const prefix = personalPrefix();
    [...serverDocs.keys()].forEach((key) => {
      if (key.startsWith(prefix)) serverDocs.delete(key);
    });
    snapshot.docs.forEach((entry) => serverDocs.set(`${prefix}${entry.id}`, entry.data()));
    personalLoaded = true;
    update();
  }, (error) => {
    console.error("Não foi possível carregar os personagens da nuvem.", error);
    setStatus("Falha ao carregar da nuvem", true);
    personalLoaded = true;
    update();
  });
  stopCampaigns = onSnapshot(campaignsQuery, { includeMetadataChanges: true }, (snapshot) => {
    if (!campaignsLoaded && snapshot.metadata.fromCache) return;
    const ids = new Set(snapshot.docs.map(({ id }) => id));
    [...campaignListeners.keys()].forEach((campaignId) => {
      if (!ids.has(campaignId)) unsubscribeCampaign(campaignId);
    });
    snapshot.docs.forEach((entry) => {
      const data = entry.data();
      const previousOwner = serverDocs.get(campaignPath(entry.id))?.ownerUid;
      serverDocs.set(campaignPath(entry.id), data);
      if (campaignListeners.has(entry.id) && previousOwner === data.ownerUid) return;
      if (entry.metadata.hasPendingWrites && !campaignListeners.has(entry.id)) return;
      unsubscribeCampaign(entry.id);
      serverDocs.set(campaignPath(entry.id), data);
      subscribeCampaign(entry.id, data);
    });
    campaignsLoaded = true;
    update();
  }, (error) => {
    console.error("Não foi possível carregar as campanhas da nuvem.", error);
    setStatus("Falha ao carregar da nuvem", true);
  });
}

function stopSession() {
  stopCampaigns?.();
  stopCampaigns = null;
  stopPersonal?.();
  stopPersonal = null;
  personalLoaded = false;
  [...campaignListeners.keys()].forEach(unsubscribeCampaign);
  clearTimeout(flushTimer);
  flushTimer = null;
  serverDocs.clear();
  pending.clear();
  ready = false;
  campaignsLoaded = false;
  selectAfterJoin = null;
}

function persistUi(currentStore) {
  ui = {
    ...ui,
    activeCampaignId: currentStore.activeCampaignId,
    activeCharacterIds: Object.fromEntries(currentStore.campaigns.map(({ id, activeCharacterId }) => [id, activeCharacterId]))
  };
  storeUi();
}

function storeUi() {
  try {
    localStorage.setItem(uiKey(), JSON.stringify(ui));
  } catch (error) {
    console.error("Não foi possível guardar a seleção atual.", error);
  }
}

function save(currentStore) {
  if (!ready || !user) return;
  persistUi(currentStore);
  const desired = new Map();
  const managed = new Set();
  const storeIds = new Set(currentStore.campaigns.map(({ id }) => id));

  viewEntries().forEach(([path, data]) => {
    if (path.startsWith(personalPrefix())) {
      managed.add(path);
      return;
    }
    const campaignId = campaignIdOf(path);
    const own = isOwnCampaign(campaignId);
    if (isCampaignPath(path)) {
      if (own) managed.add(path);
      else if (!storeIds.has(campaignId)) pending.set(path, LEAVE);
      return;
    }
    if (!storeIds.has(campaignId) && !own) return;
    if (own || data.ownerUid === user.uid) managed.add(path);
  });

  const now = new Date().toISOString();
  currentStore.campaigns.forEach((campaign) => {
    if (campaign.id === fatum.PERSONAL_ID) {
      campaign.characters.forEach(({ id, ...data }) => {
        const characterPath = `${personalPrefix()}${id}`;
        desired.set(characterPath, { ...data, createdAt: view(characterPath)?.createdAt ?? now });
      });
      return;
    }
    const path = campaignPath(campaign.id);
    const existing = view(path);
    const own = !existing || existing.ownerUid === user.uid;
    if (own) {
      const meta = existing ?? { ownerUid: user.uid, memberUids: [user.uid], joins: {}, inviteCode: createInviteCode() };
      desired.set(path, { ...meta, ...pick(campaign, CAMPAIGN_FIELDS) });
      desired.set(`${path}/private/master`, { ...campaign.master });
    }
    campaign.characters.forEach(({ id, ...data }) => {
      const characterPath = `${path}/characters/${id}`;
      const current = view(characterPath);
      if (!own && current && current.ownerUid !== user.uid) return;
      desired.set(characterPath, { ...data, ownerUid: current?.ownerUid ?? user.uid, createdAt: current?.createdAt ?? now });
    });
  });

  let changed = false;
  managed.forEach((path) => {
    if (desired.has(path)) return;
    pending.set(path, null);
    changed = true;
  });
  desired.forEach((data, path) => {
    if (stableStringify(data) === stableStringify(view(path))) return;
    pending.set(path, data);
    changed = true;
  });
  if (changed || [...pending.values()].includes(LEAVE)) scheduleFlush();
}

function scheduleFlush() {
  clearTimeout(flushTimer);
  setStatus("Salvando na nuvem…");
  flushTimer = setTimeout(flush, 400);
}

async function runAll(operations) {
  const results = await Promise.allSettled(operations.map((operation) => operation()));
  const failures = results.filter(({ status }) => status === "rejected");
  failures.forEach(({ reason }) => console.error("Falha ao salvar na nuvem.", reason));
  return failures.length === 0;
}

async function flush() {
  flushTimer = null;
  if (flushing) {
    await flushing;
    if (pending.size) flush();
    return;
  }
  const batch = [...pending.entries()];
  if (!batch.length) return;
  const creates = [];
  const writes = [];
  const deletes = [];
  const removals = [];
  batch.forEach(([path, data]) => {
    const ref = doc(db, path);
    if (isCampaignPath(path)) {
      if (data === LEAVE) {
        removals.push(() => updateDoc(ref, { memberUids: arrayRemove(user.uid) }));
      } else if (data === null) {
        const code = serverDocs.get(path)?.inviteCode;
        removals.push(async () => {
          if (code) await deleteDoc(doc(db, "invites", code));
          await deleteDoc(ref);
        });
      } else if (!serverDocs.has(path)) {
        creates.push(async () => {
          await setDoc(ref, data);
          await setDoc(doc(db, "invites", data.inviteCode), { campaignId: campaignIdOf(path) });
        });
      } else {
        writes.push(() => updateDoc(ref, pick(data, CAMPAIGN_FIELDS)));
      }
      return;
    }
    if (data === null) deletes.push(() => deleteDoc(ref));
    else writes.push(() => setDoc(ref, data));
  });

  flushing = (async () => {
    let ok = true;
    for (const group of [creates, writes, deletes, removals]) {
      if (group.length) ok = (await runAll(group)) && ok;
    }
    return ok;
  })();
  const ok = await flushing;
  flushing = null;
  batch.forEach(([path, data]) => {
    if (pending.get(path) === data) pending.delete(path);
  });
  if (!ok) {
    setStatus("Falha ao salvar na nuvem", true);
    publish();
  } else if (!pending.size) {
    setStatus("Sincronizado na nuvem");
  }
  if (pending.size && !flushTimer) scheduleFlush();
}

async function joinCampaign(rawCode) {
  const code = rawCode.trim().toUpperCase();
  const invite = await getDoc(doc(db, "invites", code));
  if (!invite.exists()) throw new Error("invite-not-found");
  const { campaignId } = invite.data();
  const existing = serverDocs.get(campaignPath(campaignId));
  if (existing) {
    fatum.selectCampaign(campaignId);
    return existing.name;
  }
  await updateDoc(doc(db, "campaigns", campaignId), {
    memberUids: arrayUnion(user.uid),
    [`joins.${user.uid}`]: code
  });
  selectAfterJoin = campaignId;
  const joined = await getDoc(doc(db, "campaigns", campaignId));
  publish();
  return joined.data()?.name ?? "campanha";
}

if (config) {
  const app = initializeApp(config);
  auth = getAuth(app);
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  if (useEmulator) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  window.fatumCloud = {
    save,
    joinCampaign,
    signIn: () => signInWithPopup(auth, new GoogleAuthProvider()),
    async signOut() {
      clearTimeout(flushTimer);
      if (pending.size) await flush();
      else if (flushing) await flushing;
      await signOut(auth);
    }
  };
  onAuthStateChanged(auth, (nextUser) => {
    stopSession();
    user = nextUser;
    if (!user) {
      fatum.exitCloud();
      return;
    }
    fatum.setAuthUser(user);
    startSession();
  });
  fatum.setCloudAvailable(true);
} else {
  fatum.setCloudAvailable(false);
}
