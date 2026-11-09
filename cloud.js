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
let stopCampaigns = null;
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

function buildStore() {
  const entries = viewEntries();
  const campaigns = entries.filter(([path]) => isCampaignPath(path)).map(([path, data]) => {
    const id = campaignIdOf(path);
    const prefix = `${path}/characters/`;
    const characters = entries
      .filter(([childPath]) => childPath.startsWith(prefix))
      .sort(([, a], [, b]) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")))
      .map(([childPath, child]) => ({ ...child, id: childPath.slice(prefix.length) }));
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
  const activeCampaignId = campaigns.some(({ id }) => id === ui.activeCampaignId) ? ui.activeCampaignId : campaigns[0]?.id;
  return { activeCampaignId, campaigns };
}

function setStatus(message, failed = false) {
  fatum.setSaveStatus(message, failed);
}

function publish() {
  if (!ready) return;
  const nextStore = buildStore();
  if (!nextStore.campaigns.length) {
    createFirstCampaigns();
    return;
  }
  fatum.applyCloudStore(nextStore);
  if (selectAfterJoin && nextStore.campaigns.some(({ id }) => id === selectAfterJoin)) {
    fatum.selectCampaign(selectAfterJoin);
    selectAfterJoin = null;
  }
}

function checkReady() {
  if (ready || !campaignsLoaded) return;
  if ([...campaignListeners.values()].some((listener) => listener.waiting > 0)) return;
  ready = true;
}

function update() {
  checkReady();
  publish();
}

function createFirstCampaigns() {
  const local = fatum.getLocalCampaigns();
  const upload = local.length > 0 && confirm(
    `Você tem ${local.length === 1 ? "1 campanha salva" : `${local.length} campanhas salvas`} neste navegador. Enviar para a sua conta Google?`
  );
  const campaigns = upload
    ? local.map((campaign) => ({ ...campaign, id: fatum.createId("campaign") }))
    : [fatum.normalizeCampaign({ name: "Minha campanha", masterName: user.displayName ?? "", characters: [] })];
  ui.activeCampaignId = campaigns[0].id;
  save({ activeCampaignId: campaigns[0].id, campaigns });
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
    activeCampaignId: currentStore.activeCampaignId,
    activeCharacterIds: Object.fromEntries(currentStore.campaigns.map(({ id, activeCharacterId }) => [id, activeCharacterId]))
  };
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
