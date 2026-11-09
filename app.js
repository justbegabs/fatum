const CAMPAIGNS_KEY = "fatum-ordem2-campaigns";
const STORAGE_KEY = "veu-ordem2-sheet";
const LEGACY_STORAGE_KEY = "veu-ordem-paranormal-sheet";
const DIE_SIZES = [4, 6, 8, 10, 12];
const MAX_IMPETUS = 3;
const DEFAULT_DT = 7;
const PROFILES = ["Executor", "Analista", "Vigilante"];
const THREAT_KINDS = ["Criatura", "NPC", "Aliado"];
const APTITUDE_OPTIONS = [
  { name: "Artes", description: "Conhecimento de música, dança, escrita, pintura, atuação e outras artes." },
  { name: "Erudição", description: "Conhecimentos acadêmicos, como aritmética, geometria e astronomia. Com d6 ou mais nesta Aptidão, o personagem é alfabetizado; caso contrário, é analfabeto." },
  { name: "Folclore", description: "Conhecimento de costumes, tradições, lendas populares e ciclos da vida." },
  { name: "Guerra", description: "Conhecimento militar e estratégico." },
  { name: "Nobreza", description: "Conhecimento de etiqueta, leis, heráldica e linhagens." },
  { name: "Religião", description: "Conhecimento de deuses, mitos, profecias e cerimônias." }
];
const PROFILE_ABILITIES = {
  Executor: {
    name: "Ímpeto",
    description: "Ao falhar em um teste, o Executor acumula Ímpeto, até 3 pontos. Ele pode usar esses pontos para receber bônus ou passos de dado adicionais ao repetir a mesma ação ou realizar uma ação ofensiva na rodada ou no próximo turno. A aplicação dos benefícios é manual."
  },
  Analista: {
    name: "Avaliação / Preparação",
    description: "O Analista abdica de sua pressa para estudar o ambiente ou a criatura. O tempo gasto analisando a situação pode conceder aumentos de passos de dados ou gerar pistas extras em cenas de investigação. A aplicação dos benefícios é manual."
  },
  Vigilante: {
    name: "Reação de Oportunidade",
    description: "O Vigilante pode agir fora do seu próprio turno ou realizar mais de uma ação na mesma rodada quando certas condições são atendidas, por exemplo, quando um aliado é atacado ou uma ameaça se move. Os gatilhos são acompanhados manualmente."
  }
};
const ATTRIBUTE_OPTIONS = [
  { key: "physical", name: "Físico" },
  { key: "mental", name: "Mente" },
  { key: "emotional", name: "Emoção" }
];

const skillDefinitions = [
  { key: "acrobatics", name: "Acrobacia", attribute: "physical", die: 4 },
  { key: "aptidao", name: "Aptidão", attribute: "mental", die: 4 },
  { key: "athletics", name: "Atletismo", attribute: "physical", die: 4 },
  { key: "crime", name: "Crime", attribute: "physical", die: 4 },
  { key: "discipline", name: "Disciplina", attribute: "emotional", die: 6 },
  { key: "deception", name: "Enganação", attribute: "emotional", die: 4 },
  { key: "stealth", name: "Furtividade", attribute: "physical", die: 4 },
  { key: "intimidate", name: "Intimidar", attribute: "emotional", die: 4 },
  { key: "intuition", name: "Intuição", attribute: "emotional", die: 6 },
  { key: "fight", name: "Luta", attribute: "physical", die: 4 },
  { key: "machines", name: "Máquinas", attribute: "mental", die: 4 },
  { key: "medicine", name: "Medicina", attribute: "mental", die: 4 },
  { key: "occultism", name: "Ocultismo", attribute: "mental", die: 4 },
  { key: "perception", name: "Percepção", attribute: "mental", die: 6 },
  { key: "persuasion", name: "Persuasão", attribute: "emotional", die: 4 },
  { key: "research", name: "Pesquisar", attribute: "mental", die: 6 },
  { key: "aim", name: "Pontaria", attribute: "physical", die: 4 },
  { key: "survival", name: "Sobrevivência", attribute: "mental", die: 4 },
  { key: "technology", name: "Tecnologia", attribute: "mental", die: 6 },
  { key: "vigor", name: "Vigor", attribute: "physical", die: 4 }
];

const defaultCharacter = {
  name: "Lia Monteiro",
  player: "",
  concept: "Pesquisadora de fenômenos incomuns",
  profile: "Analista",
  impetus: 0,
  aptitude: "",
  history: "",
  notes: "",
  occupation: "Pesquisadora",
  level: 2,
  attributes: { physical: 6, mental: 8, emotional: 8 },
  hpBonus: 0, hp: 6, hpMax: 6,
  pdBonus: 0, pd: 8, pdMax: 8,
  skills: structuredClone(skillDefinitions),
  items: [
    { name: "Lanterna de inspeção", category: "Equipamento" },
    { name: "Kit de coleta de evidências", category: "Equipamento" },
    { name: "Gravador portátil", category: "Equipamento" }
  ]
};

const byId = (id) => document.getElementById(id);
const asText = (value) => typeof value === "string" ? value : "";

function createId(prefix) {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

function normalizeCharacter(saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    throw new TypeError("Os dados salvos da ficha têm um formato inválido.");
  }
  const savedSkills = Array.isArray(saved.skills) ? saved.skills : [];
  const skills = skillDefinitions.map((definition) => {
    const savedSkill = savedSkills.find((skill) => skill?.key === definition.key);
    return {
      ...definition,
      die: DIE_SIZES.includes(Number(savedSkill?.die)) ? Number(savedSkill.die) : definition.die,
      attribute: ATTRIBUTE_OPTIONS.some(({ key }) => key === savedSkill?.attribute)
        ? savedSkill.attribute
        : definition.attribute
    };
  });
  const attributes = Object.fromEntries(ATTRIBUTE_OPTIONS.map(({ key }) => [
    key,
    DIE_SIZES.includes(Number(saved.attributes?.[key])) ? Number(saved.attributes[key]) : defaultCharacter.attributes[key]
  ]));
  const level = Number.isInteger(Number(saved.level)) && Number(saved.level) > 0 ? Number(saved.level) : defaultCharacter.level;
  const levelUpPoints = 6 * (level - 1);
  const savedHpBonus = Number(saved.hpBonus);
  const savedPdBonus = Number(saved.pdBonus);
  let hpBonus;
  let pdBonus;
  if (
    Number.isInteger(savedHpBonus) && savedHpBonus >= 0 &&
    Number.isInteger(savedPdBonus) && savedPdBonus >= 0 &&
    savedHpBonus + savedPdBonus <= levelUpPoints
  ) {
    hpBonus = savedHpBonus;
    pdBonus = savedPdBonus;
  } else {
    const previousHpBonus = Number.isInteger(Number(saved.hpMax))
      ? Math.max(0, Number(saved.hpMax) - attributes.physical)
      : defaultCharacter.hpBonus;
    const previousPdBonus = Number.isInteger(Number(saved.pdMax))
      ? Math.max(0, Number(saved.pdMax) - attributes.emotional)
      : defaultCharacter.pdBonus;
    hpBonus = Math.min(levelUpPoints, previousHpBonus);
    pdBonus = Math.min(levelUpPoints - hpBonus, previousPdBonus);
  }
  const hpMax = attributes.physical + hpBonus;
  const pdMax = attributes.emotional + pdBonus;
  const items = Array.isArray(saved.items)
    ? saved.items.filter((item) => item && typeof item.name === "string" && typeof item.category === "string")
    : structuredClone(defaultCharacter.items);

  return {
    ...structuredClone(defaultCharacter),
    id: typeof saved.id === "string" && saved.id ? saved.id : createId("agent"),
    player: asText(saved.player),
    name: typeof saved.name === "string" && saved.name.trim() ? saved.name : defaultCharacter.name,
    concept: typeof saved.concept === "string" ? saved.concept : defaultCharacter.concept,
    profile: PROFILES.includes(saved.profile) ? saved.profile : defaultCharacter.profile,
    impetus: Number.isInteger(saved.impetus) && saved.impetus >= 0 && saved.impetus <= MAX_IMPETUS ? saved.impetus : 0,
    aptitude: APTITUDE_OPTIONS.some(({ name }) => name === saved.aptitude) ? saved.aptitude : "",
    history: typeof saved.history === "string" ? saved.history : "",
    notes: typeof saved.notes === "string" ? saved.notes : "",
    occupation: typeof saved.occupation === "string" ? saved.occupation : defaultCharacter.occupation,
    level,
    attributes,
    hpBonus,
    hpMax,
    hp: Number.isInteger(Number(saved.hp)) ? Math.min(hpMax, Math.max(0, Number(saved.hp))) : defaultCharacter.hp,
    pdBonus,
    pdMax,
    pd: Number.isInteger(Number(saved.pd)) ? Math.min(pdMax, Math.max(0, Number(saved.pd))) : defaultCharacter.pd,
    skills,
    items
  };
}

function loadLegacyCharacter() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeCharacter(JSON.parse(saved));

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return normalizeCharacter(defaultCharacter);
    return normalizeCharacter(JSON.parse(legacy));
  } catch (error) {
    console.error("Não foi possível carregar a ficha salva.", error);
    return normalizeCharacter(defaultCharacter);
  }
}

function createBlankCharacter({ name, player, profile }) {
  return normalizeCharacter({
    id: createId("agent"),
    name,
    player,
    profile,
    concept: "",
    occupation: "",
    level: 1,
    attributes: { physical: 6, mental: 6, emotional: 6 },
    hp: 6,
    pd: 6,
    items: []
  });
}

function toPositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

function normalizeThreat(saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    throw new TypeError("Os dados da ameaça têm um formato inválido.");
  }
  const hpMax = toPositiveInteger(saved.hpMax, 10);
  const hp = Number(saved.hp);
  return {
    id: typeof saved.id === "string" && saved.id ? saved.id : createId("threat"),
    name: asText(saved.name).trim() || "Ameaça sem nome",
    kind: THREAT_KINDS.includes(saved.kind) ? saved.kind : THREAT_KINDS[0],
    hpMax,
    hp: Number.isInteger(hp) ? Math.min(hpMax, Math.max(0, hp)) : hpMax,
    dt: toPositiveInteger(saved.dt, DEFAULT_DT),
    notes: asText(saved.notes)
  };
}

function normalizeList(list, normalize, label) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  return list.flatMap((entry) => {
    try {
      const normalized = normalize(entry);
      if (seen.has(normalized.id)) normalized.id = createId(label);
      seen.add(normalized.id);
      return [normalized];
    } catch (error) {
      console.error(`Registro de ${label} ignorado por formato inválido.`, error);
      return [];
    }
  });
}

function normalizeCampaign(saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    throw new TypeError("Os dados da campanha têm um formato inválido.");
  }
  const characters = normalizeList(saved.characters, normalizeCharacter, "agent");
  const master = saved.master && typeof saved.master === "object" && !Array.isArray(saved.master) ? saved.master : {};
  return {
    id: typeof saved.id === "string" && saved.id ? saved.id : createId("campaign"),
    name: asText(saved.name).trim() || "Campanha sem nome",
    description: asText(saved.description),
    masterName: asText(saved.masterName),
    defaultDt: toPositiveInteger(saved.defaultDt, DEFAULT_DT),
    createdAt: asText(saved.createdAt) || new Date().toISOString(),
    activeCharacterId: characters.some(({ id }) => id === saved.activeCharacterId)
      ? saved.activeCharacterId
      : characters[0]?.id ?? null,
    characters,
    master: {
      notes: asText(master.notes),
      sessionLog: asText(master.sessionLog),
      threats: normalizeList(master.threats, normalizeThreat, "threat")
    }
  };
}

function createInitialStore() {
  const campaign = normalizeCampaign({
    name: "Operação Eclipse",
    description: "Campanha inicial com a sua ficha atual.",
    characters: [loadLegacyCharacter()]
  });
  return { activeCampaignId: campaign.id, campaigns: [campaign] };
}

function loadStore() {
  try {
    const saved = localStorage.getItem(CAMPAIGNS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const campaigns = normalizeList(parsed?.campaigns, normalizeCampaign, "campaign");
      if (campaigns.length) {
        return {
          activeCampaignId: campaigns.some(({ id }) => id === parsed.activeCampaignId) ? parsed.activeCampaignId : campaigns[0].id,
          campaigns
        };
      }
    }
  } catch (error) {
    console.error("Não foi possível carregar as campanhas salvas.", error);
  }
  return createInitialStore();
}

let store = loadStore();
let character = null;
let currentView = "sheet";

function getActiveCampaign() {
  return store.campaigns.find(({ id }) => id === store.activeCampaignId) ?? store.campaigns[0];
}

function syncActiveCharacter() {
  const campaign = getActiveCampaign();
  character = campaign.characters.find(({ id }) => id === campaign.activeCharacterId) ?? null;
}

function setSaveStatus(message, failed) {
  document.querySelector(".sync-status").innerHTML = failed
    ? escapeHtml(message)
    : `<span class="status-dot"></span> ${escapeHtml(message)}`;
  ["notes-status", "master-notes-status"].forEach((id) => {
    byId(id).textContent = failed ? message : "Salvas neste dispositivo";
    byId(id).classList.toggle("error", failed);
  });
}

function saveStore() {
  const campaign = getActiveCampaign();
  if (character) {
    const index = campaign.characters.findIndex(({ id }) => id === character.id);
    if (index >= 0) campaign.characters[index] = character;
  }
  try {
    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(store));
    setSaveStatus("Campanha salva neste dispositivo", false);
    return true;
  } catch (error) {
    console.error("Não foi possível salvar a campanha.", error);
    setSaveStatus("Falha ao salvar neste dispositivo", true);
    return false;
  }
}

function saveCharacter() {
  return saveStore();
}

[
  { id: "character-history", field: "history" },
  { id: "character-notes", field: "notes" }
].forEach(({ id, field }) => {
  const input = byId(id);
  input.addEventListener("input", () => {
    if (!character) return;
    character[field] = input.value;
    saveCharacter();
  });
});

[
  { id: "master-notes", field: "notes" },
  { id: "master-session-log", field: "sessionLog" }
].forEach(({ id, field }) => {
  const input = byId(id);
  input.addEventListener("input", () => {
    getActiveCampaign().master[field] = input.value;
    saveStore();
  });
});

function setVital(prefix, value, max) {
  byId(`${prefix}-value`).textContent = value;
  byId(`${prefix}-max`).textContent = max;
  byId(`${prefix}-meter`).style.width = `${max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0}%`;
}

function renderCharacter() {
  byId("character-title").textContent = `A ficha de ${character.name.split(" ")[0]}`;
  byId("character-name").textContent = character.name;
  byId("character-concept").textContent = [character.concept || "Agente da Ordem", character.player && `Jogador: ${character.player}`].filter(Boolean).join(" · ");
  byId("profile-pill").lastChild.textContent = ` ${character.profile.toUpperCase()}`;
  byId("character-profile").textContent = character.profile;
  byId("character-occupation").textContent = character.occupation;
  byId("level-number").textContent = character.level;
  const availablePoints = getLevelUpPoints(character.level) - character.hpBonus - character.pdBonus;
  byId("available-level-points").textContent = availablePoints;
  byId("hp-base-note").textContent = `Base ${character.attributes.physical} · +${character.hpBonus} distribuídos`;
  byId("pd-base-note").textContent = `Base ${character.attributes.emotional} · +${character.pdBonus} distribuídos`;
  setVital("hp", character.hp, character.hpMax);
  setVital("pd", character.pd, character.pdMax);
  renderAbility();
  renderInventory();
}

function renderAbility() {
  const ability = PROFILE_ABILITIES[character.profile];
  byId("ability-title").textContent = ability.name;
  byId("ability-description").textContent = ability.description;
  byId("impetus-control").hidden = character.profile !== "Executor";
  byId("impetus-value").textContent = `${character.impetus} / ${MAX_IMPETUS}`;
  byId("impetus-remove").disabled = character.impetus === 0;
  byId("impetus-add").disabled = character.impetus === MAX_IMPETUS;
}

function adjustImpetus(amount) {
  if (character.profile !== "Executor") return;
  const next = Math.max(0, Math.min(MAX_IMPETUS, character.impetus + amount));
  if (next === character.impetus) return;
  character.impetus = next;
  renderAbility();
  saveCharacter();
}

byId("impetus-remove").addEventListener("click", () => adjustImpetus(-1));
byId("impetus-add").addEventListener("click", () => adjustImpetus(1));

function renderAttributes() {
  byId("attribute-list").innerHTML = ATTRIBUTE_OPTIONS.map(({ key, name }) =>
    `<div class="attribute-row"><span class="attribute-name">${name}</span><strong class="attribute-value">d${character.attributes[key]}</strong></div>`
  ).join("");

  const dieOptions = (selected) => DIE_SIZES.map((die) =>
    `<option value="${die}" ${die === selected ? "selected" : ""}>d${die}</option>`
  ).join("");
  byId("skill-list").innerHTML = character.skills.map((skill) => {
    const name = escapeHtml(skill.name);
    const attributeName = ATTRIBUTE_OPTIONS.find(({ key }) => key === skill.attribute).name;
    return `<div class="skill-row" data-skill="${escapeHtml(skill.key)}">
      <div class="skill-label">
        <button type="button" class="skill-name" data-roll-skill aria-label="Rolar ${name}"><i class="skill-indicator"></i>${name}</button>
        ${skill.key === "aptidao" ? `<div class="aptitude-controls"><button type="button" class="aptitude-choice" id="aptitude-choice" aria-label="Escolher campo de Aptidão">${escapeHtml(character.aptitude || "Escolher campo")}</button><button type="button" class="aptitude-info" id="aptitude-info" aria-label="Informações sobre os campos de Aptidão" title="Informações sobre Aptidão">?</button></div>` : ""}
      </div>
      <label class="skill-die"><span>Perícia</span><select data-roll-die="skill" aria-label="Dado de perícia para ${name}">${dieOptions(skill.die)}</select></label>
      <label class="skill-die"><span>${attributeName}</span><select data-roll-die="attribute" aria-label="Dado de ${attributeName} para ${name}">${dieOptions(character.attributes[skill.attribute])}</select></label>
    </div>`;
  }).join("");
  renderSkillEditor();
}

function renderSkillEditor() {
  const dieOptions = (selected) => DIE_SIZES.map((die) =>
    `<option value="${die}" ${die === selected ? "selected" : ""}>d${die}</option>`
  ).join("");
  const attributeOptions = (selected) => ATTRIBUTE_OPTIONS.map(({ key, name }) =>
    `<option value="${key}" ${key === selected ? "selected" : ""}>${name}</option>`
  ).join("");

  byId("skill-editor-list").innerHTML = character.skills.map((skill) =>
    `<div class="skill-editor-row"><strong>${escapeHtml(skill.name)}</strong><label>Dado<select name="skill-die-${escapeHtml(skill.key)}">${dieOptions(skill.die)}</select></label><label>Atributo<select name="skill-attribute-${escapeHtml(skill.key)}">${attributeOptions(skill.attribute)}</select></label></div>`
  ).join("");
}

function itemSymbol(category) {
  if (category === "Arma") return "⌁";
  if (category === "Proteção") return "⬡";
  if (category === "Consumível") return "✚";
  return "▧";
}

function renderInventory() {
  const preview = byId("inventory-preview-list");
  byId("inventory-count").textContent = character.items.length;
  if (character.items.length === 0) {
    preview.innerHTML = '<p class="empty-inventory">Nenhum item no inventário ainda.</p>';
    return;
  }
  preview.innerHTML = character.items.slice(0, 4).map((item) =>
    `<div class="inventory-item"><span class="item-icon">${itemSymbol(item.category)}</span><span class="item-details"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)}</small></span><span class="item-weight">Equipado</span></div>`
  ).join("");
  if (character.items.length > 4) {
    preview.insertAdjacentHTML("beforeend", `<p class="empty-inventory">+ ${character.items.length - 4} itens no inventário</p>`);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

byId("aptitude-select").insertAdjacentHTML("beforeend", APTITUDE_OPTIONS.map(({ name }) =>
  `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`
).join(""));
byId("aptitude-definitions").innerHTML = APTITUDE_OPTIONS.map(({ name, description }) =>
  `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(description)}</dd></div>`
).join("");

function getLevelUpPoints(level) {
  return 6 * (level - 1);
}

function getVitalMaxima(attributes, hpBonus, pdBonus) {
  return {
    hpMax: attributes.physical + hpBonus,
    pdMax: attributes.emotional + pdBonus
  };
}

function updateLevelUpPreview() {
  const form = byId("character-form");
  const level = Number(form.elements.level.value);
  const hpBonus = character.hpBonus;
  const pdBonus = character.pdBonus;
  const physical = Number(form.elements.physical.value);
  const emotional = Number(form.elements.emotional.value);
  const totalPoints = Number.isSafeInteger(level) && level > 0 ? getLevelUpPoints(level) : null;
  const allocatedPoints = hpBonus + pdBonus;
  const validBonuses = Number.isInteger(hpBonus) && hpBonus >= 0 && Number.isInteger(pdBonus) && pdBonus >= 0;
  const validAttributes = DIE_SIZES.includes(physical) && DIE_SIZES.includes(emotional);
  const maxima = validAttributes && validBonuses
    ? getVitalMaxima({ physical, emotional }, hpBonus, pdBonus)
    : null;
  const invalidAllocation = totalPoints !== null && (!validBonuses || allocatedPoints > totalPoints);
  form.elements.level.setCustomValidity(totalPoints === null
    ? "Informe um nível inteiro válido."
    : invalidAllocation
      ? `Há ${allocatedPoints} pontos distribuídos, mas o nível ${level} permite apenas ${totalPoints}. Reduza a distribuição de PV/PD ou aumente o nível.`
      : "");

  byId("level-up-summary").textContent = totalPoints === null
    ? "Informe um nível válido para calcular os pontos de progressão."
    : `${totalPoints - allocatedPoints} pontos disponíveis para distribuir no botão de edição ao lado de Condição do agente. ${maxima ? `PV: base ${physical} + ${hpBonus} = ${maxima.hpMax} · PD: base ${emotional} + ${pdBonus} = ${maxima.pdMax}.` : ""}`;
  byId("level-up-summary").classList.toggle("invalid", invalidAllocation);

  if (maxima) {
    form.elements.hp.max = maxima.hpMax;
    form.elements.pd.max = maxima.pdMax;
    form.elements.hp.setCustomValidity(Number(form.elements.hp.value) > maxima.hpMax
      ? `O PV atual não pode exceder o máximo de ${maxima.hpMax}.`
      : "");
    form.elements.pd.setCustomValidity(Number(form.elements.pd.value) > maxima.pdMax
      ? `O PD atual não pode exceder o máximo de ${maxima.pdMax}.`
      : "");
  }
}

let pendingHpBonus = 0;
let pendingPdBonus = 0;

function renderVitalAllocation() {
  const available = getLevelUpPoints(character.level) - pendingHpBonus - pendingPdBonus;
  byId("allocation-level").textContent = character.level;
  byId("allocation-physical-base").textContent = character.attributes.physical;
  byId("allocation-emotional-base").textContent = character.attributes.emotional;
  byId("allocation-hp-points").textContent = pendingHpBonus;
  byId("allocation-pd-points").textContent = pendingPdBonus;
  byId("allocation-remaining").textContent = available;
  byId("allocation-hp-max").textContent = character.attributes.physical + pendingHpBonus;
  byId("allocation-pd-max").textContent = character.attributes.emotional + pendingPdBonus;
  byId("allocation-hp-add").disabled = available === 0;
  byId("allocation-pd-add").disabled = available === 0;
  byId("allocation-hp-remove").disabled = pendingHpBonus === 0;
  byId("allocation-pd-remove").disabled = pendingPdBonus === 0;
}

function adjustVitalAllocation(vital, amount) {
  const hpBonus = pendingHpBonus + (vital === "hp" ? amount : 0);
  const pdBonus = pendingPdBonus + (vital === "pd" ? amount : 0);
  const available = getLevelUpPoints(character.level) - hpBonus - pdBonus;
  if (hpBonus < 0 || pdBonus < 0 || available < 0) return;
  pendingHpBonus = hpBonus;
  pendingPdBonus = pdBonus;
  renderVitalAllocation();
}

byId("edit-vital-allocation").addEventListener("click", () => {
  pendingHpBonus = character.hpBonus;
  pendingPdBonus = character.pdBonus;
  renderVitalAllocation();
  byId("vital-allocation-dialog").showModal();
});

byId("allocation-hp-add").addEventListener("click", () => adjustVitalAllocation("hp", 1));
byId("allocation-hp-remove").addEventListener("click", () => adjustVitalAllocation("hp", -1));
byId("allocation-pd-add").addEventListener("click", () => adjustVitalAllocation("pd", 1));
byId("allocation-pd-remove").addEventListener("click", () => adjustVitalAllocation("pd", -1));

byId("vital-allocation-form").addEventListener("submit", (event) => {
  if (event.submitter?.value !== "save") return;
  const levelUpPoints = getLevelUpPoints(character.level);
  if (pendingHpBonus + pendingPdBonus > levelUpPoints) {
    event.preventDefault();
    console.error("A distribuição de pontos de PV e PD excede os pontos disponíveis.");
    return;
  }
  const { hpMax, pdMax } = getVitalMaxima(character.attributes, pendingHpBonus, pendingPdBonus);
  character = {
    ...character,
    hpBonus: pendingHpBonus,
    hpMax,
    hp: Math.max(0, Math.min(hpMax, character.hp + hpMax - character.hpMax)),
    pdBonus: pendingPdBonus,
    pdMax,
    pd: Math.max(0, Math.min(pdMax, character.pd + pdMax - character.pdMax))
  };
  renderCharacter();
  saveCharacter();
});

function openMessage(title, message) {
  byId("message-title").textContent = title;
  byId("message-text").textContent = message;
  byId("message-dialog").showModal();
}

function handleView(view) {
  const viewLabels = {
    sheet: ["Ficha de personagem", "Sua ficha continua nesta visão geral."],
    inventory: ["Inventário", "Seu equipamento está listado no painel Itens carregados. Você pode adicionar novos itens por lá."]
  };
  currentView = view;
  if (view === "master") renderMasterView();
  applyView();
  if (view === "master" || view === "notes" || view === "sheet" || !character) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (view === "abilities") {
    byId("ability-panel").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  openMessage(...viewLabels[view]);
}

function applyView() {
  const isMaster = currentView === "master";
  const isNotes = currentView === "notes";
  byId("master-view").hidden = !isMaster;
  byId("sheet-view").hidden = isMaster || isNotes || !character;
  byId("notes-panel").hidden = !isNotes || !character;
  byId("empty-sheet-panel").hidden = isMaster || Boolean(character);
  byId("breadcrumb-section").textContent = isMaster ? "Ficha do mestre" : character ? character.name : "Personagens";
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === currentView);
  });
  document.querySelectorAll(".agent-nav-item").forEach((button) => {
    button.classList.toggle("active", !isMaster && button.dataset.agentId === character?.id);
  });
}

function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function renderCampaignChrome() {
  const campaign = getActiveCampaign();
  byId("campaign-switcher-name").textContent = campaign.name;
  byId("campaign-switcher-meta").textContent = `Campanha · ${pluralize(campaign.characters.length, "agente", "agentes")}`;
  byId("breadcrumb-campaign").textContent = campaign.name;
  byId("threat-count").textContent = campaign.master.threats.length;
  byId("default-dt-value").textContent = campaign.defaultDt;
  byId("agent-nav").innerHTML = campaign.characters.map((agent) =>
    `<button type="button" class="agent-nav-item" data-agent-id="${escapeHtml(agent.id)}"><span class="agent-avatar">${escapeHtml(initials(agent.name))}</span><span class="agent-nav-copy"><strong>${escapeHtml(agent.name)}</strong><small>${escapeHtml([agent.player, `${agent.profile} · Nv ${agent.level}`].filter(Boolean).join(" · "))}</small></span></button>`
  ).join("") || '<p class="agent-nav-empty">Nenhuma ficha ainda.</p>';
}

function renderActiveCharacter() {
  if (!character) {
    byId("inventory-count").textContent = 0;
    return;
  }
  renderCharacter();
  renderAttributes();
  byId("character-history").value = character.history;
  byId("character-notes").value = character.notes;
}

function vitalAdjuster({ label, kind, targetId, vital, value, max, scope }) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const id = escapeHtml(targetId);
  return `<div class="mini-vital ${kind}">
    <span class="mini-vital-label">${label}</span>
    <div class="point-adjust compact">
      <button type="button" data-adjust="${scope}" data-target="${id}" data-vital="${vital}" data-amount="-1" aria-label="Remover 1 ${label}" ${value <= 0 ? "disabled" : ""}>−</button>
      <strong>${value} / ${max}</strong>
      <button type="button" data-adjust="${scope}" data-target="${id}" data-vital="${vital}" data-amount="1" aria-label="Adicionar 1 ${label}" ${value >= max ? "disabled" : ""}>+</button>
    </div>
    <div class="meter"><i style="width: ${percent}%"></i></div>
  </div>`;
}

function renderMasterView() {
  const campaign = getActiveCampaign();
  byId("master-campaign-name").textContent = campaign.name;
  byId("master-campaign-description").textContent = campaign.description || "Ficha do mestre: acompanhe os agentes, as ameaças e os segredos da campanha.";
  byId("master-name-label").textContent = campaign.masterName ? `MESTRE · ${campaign.masterName.toUpperCase()}` : "MESTRE";
  byId("master-agent-total").textContent = campaign.characters.length;
  byId("master-threat-total").textContent = campaign.master.threats.length;
  byId("master-default-dt").textContent = campaign.defaultDt;
  const createdAt = new Date(campaign.createdAt);
  byId("master-created-at").textContent = Number.isNaN(createdAt.getTime()) ? "—" : createdAt.toLocaleDateString("pt-BR");
  byId("master-notes").value = campaign.master.notes;
  byId("master-session-log").value = campaign.master.sessionLog;

  byId("master-agent-list").innerHTML = campaign.characters.map((agent) => {
    const attributes = ATTRIBUTE_OPTIONS.map(({ key, name }) => `<span>${name} <b>d${agent.attributes[key]}</b></span>`).join("");
    const meta = [agent.player && `Jogador: ${agent.player}`, agent.profile, `Nível ${agent.level}`].filter(Boolean).join(" · ");
    return `<article class="master-agent-card">
      <div class="master-agent-head">
        <span class="agent-avatar">${escapeHtml(initials(agent.name))}</span>
        <div class="master-agent-title"><strong>${escapeHtml(agent.name)}</strong><small>${escapeHtml(meta)}</small></div>
        <button type="button" class="text-button" data-open-agent="${escapeHtml(agent.id)}">Abrir ficha <span>↗</span></button>
      </div>
      <div class="master-agent-stats">
        ${vitalAdjuster({ label: "PV", kind: "health", targetId: agent.id, vital: "hp", value: agent.hp, max: agent.hpMax, scope: "agent" })}
        ${vitalAdjuster({ label: "PD", kind: "determination", targetId: agent.id, vital: "pd", value: agent.pd, max: agent.pdMax, scope: "agent" })}
      </div>
      <div class="master-agent-attributes">${attributes}${agent.profile === "Executor" ? `<span>Ímpeto <b>${agent.impetus} / ${MAX_IMPETUS}</b></span>` : ""}</div>
    </article>`;
  }).join("") || '<p class="empty-inventory">Nenhuma ficha de jogador nesta campanha ainda. Crie uma nova ficha ou importe a ficha exportada por um jogador.</p>';

  byId("threat-list").innerHTML = campaign.master.threats.map((threat) =>
    `<article class="threat-card">
      <div class="threat-head">
        <span class="pill pill-red"><i></i> ${escapeHtml(threat.kind.toUpperCase())}</span>
        <strong>${escapeHtml(threat.name)}</strong>
        <span class="threat-dt">DT ${threat.dt}</span>
        <button type="button" class="threat-remove" data-remove-threat="${escapeHtml(threat.id)}" aria-label="Remover ${escapeHtml(threat.name)}" title="Remover">×</button>
      </div>
      ${vitalAdjuster({ label: "PV", kind: "health", targetId: threat.id, vital: "hp", value: threat.hp, max: threat.hpMax, scope: "threat" })}
      ${threat.notes ? `<p class="threat-notes">${escapeHtml(threat.notes)}</p>` : ""}
    </article>`
  ).join("") || '<p class="empty-inventory">Nenhuma ameaça ou NPC registrado.</p>';
}

function renderApp() {
  renderCampaignChrome();
  renderActiveCharacter();
  renderMasterView();
  applyView();
}

function selectAgent(agentId) {
  const campaign = getActiveCampaign();
  if (!campaign.characters.some(({ id }) => id === agentId)) return;
  saveStore();
  campaign.activeCharacterId = agentId;
  syncActiveCharacter();
  currentView = "sheet";
  saveStore();
  renderApp();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function selectCampaign(campaignId) {
  if (!store.campaigns.some(({ id }) => id === campaignId)) return;
  saveStore();
  store.activeCampaignId = campaignId;
  syncActiveCharacter();
  byId("roll-dt").value = getActiveCampaign().defaultDt;
  saveStore();
  renderApp();
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    handleView(button.dataset.view);
    byId("sidebar").classList.remove("open");
  });
});

document.querySelectorAll(".section-tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(".section-tab.active")?.classList.remove("active");
    button.classList.add("active");
    const tab = button.dataset.tab;
    if (tab === "attributes") byId("attribute-list").scrollIntoView({ behavior: "smooth", block: "center" });
    if (tab === "inventory") byId("inventory-preview-list").scrollIntoView({ behavior: "smooth", block: "center" });
    if (tab === "combat") byId("hp-value").scrollIntoView({ behavior: "smooth", block: "center" });
    if (tab === "overview") window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

document.querySelectorAll("[data-tab-link]").forEach((button) => {
  button.addEventListener("click", () => {
    const tab = button.dataset.tabLink;
    document.querySelector(`.section-tab[data-tab="${tab}"]`).click();
  });
});

byId("edit-button").addEventListener("click", () => {
  const form = byId("character-form");
  form.elements.name.value = character.name;
  form.elements.concept.value = character.concept;
  form.elements.player.value = character.player;
  form.elements.profile.value = character.profile;
  form.elements.occupation.value = character.occupation;
  form.elements.level.value = character.level;
  ATTRIBUTE_OPTIONS.forEach(({ key }) => {
    form.elements[key].value = character.attributes[key];
  });
  form.elements.hp.value = character.hp;
  form.elements.pd.value = character.pd;
  form.querySelectorAll('input[name="level"], input[name="hp"], input[name="pd"]').forEach((input) => input.setCustomValidity(""));
  renderSkillEditor();
  updateLevelUpPreview();
  byId("character-dialog").showModal();
});

byId("character-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const level = Number(form.elements.level.value);
  const levelUpPoints = getLevelUpPoints(level);
  const hpBonus = character.hpBonus;
  const pdBonus = character.pdBonus;
  if (!Number.isSafeInteger(level) || level < 1 || hpBonus + pdBonus > levelUpPoints) {
    form.elements.level.setCustomValidity(`Os ${hpBonus + pdBonus} pontos já distribuídos exigem nível ${Math.ceil((hpBonus + pdBonus) / 6) + 1} ou superior.`);
    form.elements.level.reportValidity();
    return;
  }
  const attributes = Object.fromEntries(ATTRIBUTE_OPTIONS.map(({ key }) => [key, Number(form.elements[key].value)]));
  const { hpMax, pdMax } = getVitalMaxima(attributes, hpBonus, pdBonus);
  const hp = Number(form.elements.hp.value);
  const pd = Number(form.elements.pd.value);
  if (!Number.isInteger(hp) || hp < 0 || hp > hpMax || !Number.isInteger(pd) || pd < 0 || pd > pdMax) {
    const invalidHp = !Number.isInteger(hp) || hp < 0 || hp > hpMax;
    const invalidInput = invalidHp ? form.elements.hp : form.elements.pd;
    const invalidMax = invalidHp ? hpMax : pdMax;
    invalidInput.setCustomValidity(`Informe um valor inteiro entre 0 e o máximo (${invalidMax}).`);
    invalidInput.reportValidity();
    return;
  }
  character = {
    ...character,
    name: form.elements.name.value.trim() || character.name,
    concept: form.elements.concept.value.trim(),
    player: form.elements.player.value.trim(),
    profile: form.elements.profile.value,
    occupation: form.elements.occupation.value.trim(),
    level,
    attributes,
    hpBonus, hpMax, hp,
    pdBonus, pdMax, pd,
    skills: character.skills.map((skill) => ({
      ...skill,
      die: Number(form.elements[`skill-die-${skill.key}`].value),
      attribute: form.elements[`skill-attribute-${skill.key}`].value
    }))
  };
  saveCharacter();
  renderApp();
  byId("character-dialog").close();
});

byId("character-form").querySelectorAll('input[name="level"], input[name="hp"], input[name="pd"], select[name="physical"], select[name="emotional"]').forEach((input) => {
  input.addEventListener("input", () => {
    input.setCustomValidity("");
    updateLevelUpPreview();
  });
  input.addEventListener("change", () => {
    input.setCustomValidity("");
    updateLevelUpPreview();
  });
});

[
  { attribute: "physical", vital: "hp", bonus: "hpBonus" },
  { attribute: "emotional", vital: "pd", bonus: "pdBonus" }
].forEach(({ attribute, vital, bonus }) => {
  const form = byId("character-form");
  form.elements[attribute].addEventListener("change", () => {
    const newBase = Number(form.elements[attribute].value);
    form.elements[vital].value = newBase + character[bonus];
    updateLevelUpPreview();
  });
});

byId("add-item-button").addEventListener("click", () => {
  byId("item-form").reset();
  byId("item-dialog").showModal();
});

byId("item-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const name = form.elements.item.value.trim();
  if (!name) return;
  character.items.push({ name, category: form.elements.category.value });
  renderInventory();
  saveCharacter();
  byId("item-dialog").close();
});

function rollSelectedSkill(row) {
  const skill = character.skills.find(({ key }) => key === row.dataset.skill);
  const dt = Number(byId("roll-dt").value);
  if (!skill) {
    console.error("A perícia selecionada não existe na ficha.");
    openMessage("Não foi possível rolar", "A perícia selecionada não foi encontrada na ficha.");
    return;
  }
  if (!byId("roll-dt").value || !Number.isInteger(dt) || dt < 1) {
    byId("roll-dt").setCustomValidity("Informe uma DT igual ou maior que 1.");
    byId("roll-dt").reportValidity();
    return;
  }
  byId("roll-dt").setCustomValidity("");
  const attributeDie = Number(row.querySelector('[data-roll-die="attribute"]').value);
  const skillDie = Number(row.querySelector('[data-roll-die="skill"]').value);
  if (!DIE_SIZES.includes(attributeDie) || !DIE_SIZES.includes(skillDie)) {
    console.error("Dados inválidos para o teste de perícia.");
    openMessage("Não foi possível rolar", "Selecione dados válidos para o atributo e a perícia.");
    return;
  }
  const attributeRoll = Math.floor(Math.random() * attributeDie) + 1;
  const skillRoll = Math.floor(Math.random() * skillDie) + 1;
  const total = attributeRoll + skillRoll;
  const outcome = total >= dt ? "Sucesso" : "Falha";
  let impetusMessage = "";
  if (outcome === "Falha" && character.profile === "Executor") {
    const previousImpetus = character.impetus;
    adjustImpetus(1);
    impetusMessage = previousImpetus < MAX_IMPETUS
      ? `<br>+1 Ímpeto (${character.impetus} / ${MAX_IMPETUS})`
      : `<br>Ímpeto no máximo (${MAX_IMPETUS} / ${MAX_IMPETUS})`;
  }
  byId("roll-title").textContent = skill.key === "aptidao" && character.aptitude
    ? `${skill.name} (${character.aptitude})`
    : skill.name;
  byId("roll-result").innerHTML = `<strong>d${attributeDie} (${attributeRoll}) + d${skillDie} (${skillRoll}) = ${total}</strong><br>${outcome} · DT ${dt}${impetusMessage}`;
  byId("roll-dialog").showModal();
}

byId("skill-list").addEventListener("click", (event) => {
  if (event.target.closest("#aptitude-choice")) {
    byId("aptitude-select").value = character.aptitude;
    byId("aptitude-dialog").showModal();
    return;
  }
  if (event.target.closest("#aptitude-info")) {
    byId("aptitude-info-dialog").showModal();
    return;
  }
  const button = event.target.closest("button[data-roll-skill]");
  if (!button) return;
  rollSelectedSkill(button.closest("[data-skill]"));
});

byId("aptitude-form").addEventListener("submit", (event) => {
  if (event.submitter?.value !== "save") return;
  const aptitude = byId("aptitude-select").value;
  if (aptitude && !APTITUDE_OPTIONS.some(({ name }) => name === aptitude)) {
    event.preventDefault();
    console.error("Campo de Aptidão inválido.");
    byId("aptitude-select").setCustomValidity("Selecione um campo de Aptidão válido.");
    byId("aptitude-select").reportValidity();
    return;
  }
  character.aptitude = aptitude;
  byId("aptitude-choice").textContent = aptitude || "Escolher campo";
  saveCharacter();
});
byId("aptitude-select").addEventListener("change", () => byId("aptitude-select").setCustomValidity(""));

byId("roll-dt").addEventListener("input", () => byId("roll-dt").setCustomValidity(""));

byId("share-button").addEventListener("click", async () => {
  if (!character || currentView === "master") {
    const campaign = getActiveCampaign();
    openMessage("Compartilhar campanha", `Para levar a campanha ${campaign.name} para outro dispositivo, use Exportar atual no seletor de campanhas.`);
    return;
  }
  const shareData = { title: `Ficha de ${character.name}`, text: `Ficha de personagem de ${character.name} — Ordem 2.` };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch (error) {
      if (error.name !== "AbortError") openMessage("Não foi possível compartilhar", "Tente novamente ou copie o nome do agente para compartilhar a ficha.");
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${shareData.text} (${location.href})`);
    openMessage("Ficha copiada", "O link desta página foi copiado. Compartilhe com seu grupo.");
  } catch (error) {
    openMessage("Compartilhar ficha", `${shareData.text} Abra esta página no navegador para copiar o link.`);
  }
});

byId("help-button").addEventListener("click", () => {
  openMessage("Como usar sua ficha", "Clique no nome de uma perícia para rolar seu dado e o dado do atributo-base contra a DT. Em Aptidão, escolha o campo de conhecimento e use ? para consultar as opções. Ajuste cada dado junto à perícia para o teste; esses ajustes não mudam a ficha e são reiniciados ao recarregar ou editar o personagem. A habilidade principal depende do perfil. O Executor ganha Ímpeto ao falhar e pode ajustar ou gastar pontos manualmente; os benefícios das habilidades são aplicados manualmente. Para editar os dados permanentes, use Editar personagem. PV começa em Físico e PD em Emoção; distribua os pontos de nível no botão ao lado de Condição do agente. No seletor de campanhas você cria e troca de campanha; cada campanha tem uma Ficha do mestre, com agentes, ameaças e anotações, e as fichas dos jogadores, listadas na barra lateral.");
});

function renderCampaignList() {
  const canDelete = store.campaigns.length > 1;
  byId("campaign-list").innerHTML = store.campaigns.map((campaign) => {
    const isActive = campaign.id === store.activeCampaignId;
    const meta = [pluralize(campaign.characters.length, "agente", "agentes"), campaign.masterName && `Mestre: ${campaign.masterName}`].filter(Boolean).join(" · ");
    return `<div class="campaign-option ${isActive ? "active" : ""}">
      <button type="button" class="campaign-select" data-select-campaign="${escapeHtml(campaign.id)}" ${isActive ? 'aria-current="true"' : ""}>
        <span class="campaign-icon">⌖</span>
        <span class="campaign-copy"><strong>${escapeHtml(campaign.name)}</strong><small>${escapeHtml(meta)}</small></span>
        ${isActive ? '<span class="campaign-active-label">ATIVA</span>' : ""}
      </button>
      <button type="button" class="threat-remove" data-delete-campaign="${escapeHtml(campaign.id)}" aria-label="Excluir campanha ${escapeHtml(campaign.name)}" title="${canDelete ? "Excluir campanha" : "Mantenha ao menos uma campanha"}" ${canDelete ? "" : "disabled"}>×</button>
    </div>`;
  }).join("");
}

byId("campaign-list").addEventListener("click", (event) => {
  const select = event.target.closest("[data-select-campaign]");
  if (select) {
    selectCampaign(select.dataset.selectCampaign);
    byId("campaign-dialog").close();
    return;
  }
  const remove = event.target.closest("[data-delete-campaign]");
  if (!remove || store.campaigns.length <= 1) return;
  const campaign = store.campaigns.find(({ id }) => id === remove.dataset.deleteCampaign);
  if (!campaign || !confirm(`Excluir a campanha "${campaign.name}" com todas as suas fichas? Esta ação não pode ser desfeita.`)) return;
  saveStore();
  store.campaigns = store.campaigns.filter(({ id }) => id !== campaign.id);
  if (store.activeCampaignId === campaign.id) {
    store.activeCampaignId = store.campaigns[0].id;
    syncActiveCharacter();
    byId("roll-dt").value = getActiveCampaign().defaultDt;
  }
  saveStore();
  renderApp();
  renderCampaignList();
});

function openCampaignForm(mode) {
  const form = byId("campaign-form");
  const campaign = getActiveCampaign();
  const editing = mode === "edit";
  form.dataset.mode = mode;
  form.reset();
  byId("campaign-form-title").textContent = editing ? "Editar campanha" : "Nova campanha";
  byId("campaign-form-submit").textContent = editing ? "Salvar campanha" : "Criar campanha";
  form.elements.name.value = editing ? campaign.name : "";
  form.elements.description.value = editing ? campaign.description : "";
  form.elements.masterName.value = editing ? campaign.masterName : "";
  form.elements.defaultDt.value = editing ? campaign.defaultDt : DEFAULT_DT;
  byId("campaign-form-dialog").showModal();
}

byId("new-campaign-button").addEventListener("click", () => {
  byId("campaign-dialog").close();
  openCampaignForm("create");
});
byId("edit-campaign-button").addEventListener("click", () => openCampaignForm("edit"));

byId("campaign-form").addEventListener("submit", (event) => {
  if (event.submitter?.value !== "save") return;
  const form = event.currentTarget;
  const name = form.elements.name.value.trim();
  const defaultDt = Number(form.elements.defaultDt.value);
  if (!name) {
    event.preventDefault();
    form.elements.name.setCustomValidity("Informe o nome da campanha.");
    form.elements.name.reportValidity();
    return;
  }
  if (!Number.isSafeInteger(defaultDt) || defaultDt < 1) {
    event.preventDefault();
    form.elements.defaultDt.setCustomValidity("Informe uma DT igual ou maior que 1.");
    form.elements.defaultDt.reportValidity();
    return;
  }
  const details = {
    name,
    description: form.elements.description.value.trim(),
    masterName: form.elements.masterName.value.trim(),
    defaultDt
  };
  if (form.dataset.mode === "edit") {
    Object.assign(getActiveCampaign(), details);
    byId("roll-dt").value = defaultDt;
    saveStore();
    renderApp();
    return;
  }
  const campaign = normalizeCampaign(details);
  store.campaigns.push(campaign);
  currentView = "master";
  selectCampaign(campaign.id);
});
byId("campaign-form").querySelectorAll("input").forEach((input) => {
  input.addEventListener("input", () => input.setCustomValidity(""));
});

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "arquivo";
}

function downloadJson(filename, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function readJsonFile(input) {
  const [file] = input.files;
  input.value = "";
  if (!file) return null;
  try {
    return JSON.parse(await file.text());
  } catch (error) {
    console.error("Arquivo de importação inválido.", error);
    openMessage("Não foi possível importar", "O arquivo selecionado não é um JSON válido exportado pelo Fatum.");
    return null;
  }
}

byId("export-campaign-button").addEventListener("click", () => {
  saveStore();
  const campaign = getActiveCampaign();
  downloadJson(`campanha-${slugify(campaign.name)}.json`, { format: "fatum-ordem2-campaign", version: 1, campaign });
});

byId("import-campaign-button").addEventListener("click", () => byId("import-campaign-input").click());
byId("import-campaign-input").addEventListener("change", async (event) => {
  const data = await readJsonFile(event.currentTarget);
  if (!data) return;
  try {
    const isCampaign = data.format === "fatum-ordem2-campaign" || (!data.format && Array.isArray(data.characters));
    if (!isCampaign) throw new TypeError("O arquivo não é uma campanha exportada.");
    const campaign = normalizeCampaign(data.format ? data.campaign : data);
    if (store.campaigns.some(({ id }) => id === campaign.id)) {
      campaign.id = createId("campaign");
      campaign.name = `${campaign.name} (cópia)`;
    }
    store.campaigns.push(campaign);
    byId("campaign-dialog").close();
    currentView = "master";
    selectCampaign(campaign.id);
    openMessage("Campanha importada", `A campanha ${campaign.name} foi adicionada com ${pluralize(campaign.characters.length, "ficha", "fichas")}.`);
  } catch (error) {
    console.error("Não foi possível importar a campanha.", error);
    openMessage("Não foi possível importar", "O arquivo não contém uma campanha válida.");
  }
});

byId("export-character-button").addEventListener("click", () => {
  if (!character) return;
  saveCharacter();
  downloadJson(`ficha-${slugify(character.name)}.json`, { format: "fatum-ordem2-character", version: 1, character });
});

byId("import-character-input").addEventListener("change", async (event) => {
  const data = await readJsonFile(event.currentTarget);
  if (!data) return;
  let imported;
  try {
    const isCharacter = data.format === "fatum-ordem2-character" || (!data.format && typeof data.name === "string" && data.attributes);
    if (!isCharacter) throw new TypeError("O arquivo não é uma ficha exportada.");
    imported = normalizeCharacter(data.format ? data.character : data);
  } catch (error) {
    console.error("Não foi possível importar a ficha.", error);
    openMessage("Não foi possível importar", "O arquivo não contém uma ficha de personagem válida.");
    return;
  }
  const campaign = getActiveCampaign();
  saveStore();
  const index = campaign.characters.findIndex(({ id }) => id === imported.id);
  if (index >= 0) {
    if (!confirm(`A ficha de ${campaign.characters[index].name} já está nesta campanha. Substituir pela versão importada?`)) return;
    campaign.characters[index] = imported;
    if (character?.id === imported.id) character = imported;
  } else {
    campaign.characters.push(imported);
  }
  if (!character) {
    campaign.activeCharacterId = imported.id;
    syncActiveCharacter();
  }
  saveStore();
  renderApp();
  openMessage("Ficha importada", `A ficha de ${imported.name} foi adicionada à campanha ${campaign.name}.`);
});

document.addEventListener("click", (event) => {
  if (event.target.closest("[data-import-character]")) {
    byId("import-character-input").click();
    return;
  }
  if (event.target.closest("[data-new-agent]")) {
    byId("agent-form").reset();
    byId("agent-dialog").showModal();
  }
});

byId("add-agent-button").addEventListener("click", () => {
  byId("agent-form").reset();
  byId("agent-dialog").showModal();
  byId("sidebar").classList.remove("open");
});

byId("agent-nav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-agent-id]");
  if (!button) return;
  selectAgent(button.dataset.agentId);
  byId("sidebar").classList.remove("open");
});

byId("agent-form").addEventListener("submit", (event) => {
  if (event.submitter?.value !== "save") return;
  const form = event.currentTarget;
  const name = form.elements.name.value.trim();
  if (!name) {
    event.preventDefault();
    form.elements.name.setCustomValidity("Informe o nome do personagem.");
    form.elements.name.reportValidity();
    return;
  }
  const agent = createBlankCharacter({ name, player: form.elements.player.value.trim(), profile: form.elements.profile.value });
  getActiveCampaign().characters.push(agent);
  selectAgent(agent.id);
  setTimeout(() => byId("edit-button").click(), 0);
});
byId("agent-form").elements.name.addEventListener("input", (event) => event.currentTarget.setCustomValidity(""));

byId("delete-character").addEventListener("click", () => {
  if (!character || !confirm(`Excluir a ficha de ${character.name}? Esta ação não pode ser desfeita.`)) return;
  const campaign = getActiveCampaign();
  campaign.characters = campaign.characters.filter(({ id }) => id !== character.id);
  campaign.activeCharacterId = campaign.characters[0]?.id ?? null;
  syncActiveCharacter();
  saveStore();
  byId("character-dialog").close();
  renderApp();
});

byId("master-agent-list").addEventListener("click", (event) => {
  const open = event.target.closest("[data-open-agent]");
  if (open) {
    selectAgent(open.dataset.openAgent);
    return;
  }
  const adjust = event.target.closest('[data-adjust="agent"]');
  if (!adjust) return;
  const campaign = getActiveCampaign();
  const index = campaign.characters.findIndex(({ id }) => id === adjust.dataset.target);
  if (index < 0) return;
  saveStore();
  const agent = campaign.characters[index];
  const vital = adjust.dataset.vital;
  const max = vital === "hp" ? agent.hpMax : agent.pdMax;
  const updated = { ...agent, [vital]: Math.max(0, Math.min(max, agent[vital] + Number(adjust.dataset.amount))) };
  campaign.characters[index] = updated;
  if (character?.id === updated.id) {
    character = updated;
    renderCharacter();
  }
  saveStore();
  renderMasterView();
});

byId("threat-list").addEventListener("click", (event) => {
  const campaign = getActiveCampaign();
  const remove = event.target.closest("[data-remove-threat]");
  if (remove) {
    const threat = campaign.master.threats.find(({ id }) => id === remove.dataset.removeThreat);
    if (!threat || !confirm(`Remover ${threat.name} da ficha do mestre?`)) return;
    campaign.master.threats = campaign.master.threats.filter(({ id }) => id !== threat.id);
    saveStore();
    renderCampaignChrome();
    renderMasterView();
    return;
  }
  const adjust = event.target.closest('[data-adjust="threat"]');
  if (!adjust) return;
  const threat = campaign.master.threats.find(({ id }) => id === adjust.dataset.target);
  if (!threat) return;
  threat.hp = Math.max(0, Math.min(threat.hpMax, threat.hp + Number(adjust.dataset.amount)));
  saveStore();
  renderMasterView();
});

byId("add-threat-button").addEventListener("click", () => {
  const form = byId("threat-form");
  form.reset();
  form.elements.dt.value = getActiveCampaign().defaultDt;
  byId("threat-dialog").showModal();
});

byId("threat-form").addEventListener("submit", (event) => {
  if (event.submitter?.value !== "save") return;
  const form = event.currentTarget;
  const name = form.elements.name.value.trim();
  const hpMax = Number(form.elements.hpMax.value);
  const dt = Number(form.elements.dt.value);
  const invalid = !name
    ? [form.elements.name, "Informe o nome da ameaça ou NPC."]
    : !Number.isSafeInteger(hpMax) || hpMax < 1
      ? [form.elements.hpMax, "Informe um PV máximo igual ou maior que 1."]
      : !Number.isSafeInteger(dt) || dt < 1
        ? [form.elements.dt, "Informe uma DT igual ou maior que 1."]
        : null;
  if (invalid) {
    event.preventDefault();
    invalid[0].setCustomValidity(invalid[1]);
    invalid[0].reportValidity();
    return;
  }
  const campaign = getActiveCampaign();
  campaign.master.threats.push(normalizeThreat({ name, kind: form.elements.kind.value, hpMax, hp: hpMax, dt, notes: form.elements.notes.value.trim() }));
  saveStore();
  renderCampaignChrome();
  renderMasterView();
});
byId("threat-form").querySelectorAll("input").forEach((input) => {
  input.addEventListener("input", () => input.setCustomValidity(""));
});

window.addEventListener("storage", (event) => {
  if (event.key !== CAMPAIGNS_KEY || event.newValue === null) return;
  const activeCampaignId = store.activeCampaignId;
  const activeCharacterId = character?.id ?? null;
  store = loadStore();
  const campaign = store.campaigns.find(({ id }) => id === activeCampaignId);
  if (campaign) {
    store.activeCampaignId = activeCampaignId;
    if (campaign.characters.some(({ id }) => id === activeCharacterId)) campaign.activeCharacterId = activeCharacterId;
  }
  syncActiveCharacter();
  if ((character?.id ?? null) !== activeCharacterId) byId("character-dialog").close();
  renderApp();
});

byId("mobile-menu").addEventListener("click", () => byId("sidebar").classList.toggle("open"));
document.querySelector(".campaign-switcher").addEventListener("click", () => {
  renderCampaignList();
  byId("campaign-dialog").showModal();
});
document.querySelector(".profile-button").addEventListener("click", () => openMessage("Perfil do jogador", "Você está usando a ficha local como Gabriel."));

syncActiveCharacter();
byId("roll-dt").value = getActiveCampaign().defaultDt;
renderApp();
