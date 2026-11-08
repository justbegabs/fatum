const STORAGE_KEY = "veu-ordem2-sheet";
const LEGACY_STORAGE_KEY = "veu-ordem-paranormal-sheet";
const DIE_SIZES = [4, 6, 8, 10, 12];
const MAX_IMPETUS = 3;
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

let character = loadCharacter();
const byId = (id) => document.getElementById(id);

function normalizeCharacter(saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
    throw new TypeError("Os dados salvos da ficha têm um formato inválido.");
  }
  const allowedProfiles = ["Executor", "Analista", "Vigilante"];
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
    name: typeof saved.name === "string" && saved.name.trim() ? saved.name : defaultCharacter.name,
    concept: typeof saved.concept === "string" ? saved.concept : defaultCharacter.concept,
    profile: allowedProfiles.includes(saved.profile) ? saved.profile : defaultCharacter.profile,
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

function loadCharacter() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeCharacter(JSON.parse(saved));

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return structuredClone(defaultCharacter);
    const previousCharacter = JSON.parse(legacy);
    return normalizeCharacter(previousCharacter);
  } catch (error) {
    console.error("Não foi possível carregar a ficha salva.", error);
    return structuredClone(defaultCharacter);
  }
}

function saveCharacter() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
    document.querySelector(".sync-status").innerHTML = '<span class="status-dot"></span> Ficha salva neste dispositivo';
    byId("notes-status").textContent = "Salvas neste dispositivo";
    byId("notes-status").classList.remove("error");
    return true;
  } catch (error) {
    console.error("Não foi possível salvar a ficha.", error);
    document.querySelector(".sync-status").textContent = "Falha ao salvar neste dispositivo";
    byId("notes-status").textContent = "Falha ao salvar neste dispositivo";
    byId("notes-status").classList.add("error");
    return false;
  }
}

[
  { id: "character-history", field: "history" },
  { id: "character-notes", field: "notes" }
].forEach(({ id, field }) => {
  const input = byId(id);
  input.value = character[field];
  input.addEventListener("input", () => {
    character[field] = input.value;
    saveCharacter();
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
  byId("character-concept").textContent = character.concept || "Agente da Ordem";
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
  const isNotes = view === "notes";
  byId("sheet-view").hidden = isNotes;
  byId("notes-panel").hidden = !isNotes;
  if (isNotes || view === "sheet") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (view === "abilities") {
    byId("ability-panel").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  openMessage(...viewLabels[view]);
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector(".nav-item.active")?.classList.remove("active");
    button.classList.add("active");
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
  renderCharacter();
  renderAttributes();
  saveCharacter();
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
  openMessage("Como usar sua ficha", "Clique no nome de uma perícia para rolar seu dado e o dado do atributo-base contra a DT. Em Aptidão, escolha o campo de conhecimento e use ? para consultar as opções. Ajuste cada dado junto à perícia para o teste; esses ajustes não mudam a ficha e são reiniciados ao recarregar ou editar o personagem. A habilidade principal depende do perfil. O Executor ganha Ímpeto ao falhar e pode ajustar ou gastar pontos manualmente; os benefícios das habilidades são aplicados manualmente. Para editar os dados permanentes, use Editar personagem. PV começa em Físico e PD em Emoção; distribua os pontos de nível no botão ao lado de Condição do agente.");
});

byId("mobile-menu").addEventListener("click", () => byId("sidebar").classList.toggle("open"));
document.querySelector(".campaign-switcher").addEventListener("click", () => openMessage("Operação Eclipse", "Campanha ativa · 4 agentes. O gerenciamento da campanha estará disponível em breve."));
document.querySelector(".profile-button").addEventListener("click", () => openMessage("Perfil do jogador", "Você está usando a ficha local como Gabriel."));

renderCharacter();
renderAttributes();
