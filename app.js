const state = {
  recipes: [],
  tag: '',
};

const $ = (selector) => document.querySelector(selector);
const recipesEl = $('#recipes');
const template = $('#recipe-card-template');
const controlsEl = $('.controls');
const summaryEl = $('.result-summary');
const filtersToggleEl = $('#filtersToggle');
const filtersPanelEl = $('#filtersPanel');
const filters = {
  search: $('#search'),
  cuisine: $('#cuisine'),
  diet: $('#diet'),
  course: $('#course'),
  effort: $('#effort'),
};

const normalize = (value) => String(value || '').trim().toLowerCase();
const uniq = (items) => [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
const recipeUrl = (recipe) => `#recipe/${encodeURIComponent(recipe.id)}`;

async function loadRecipes() {
  const response = await fetch('recipes.json', { cache: 'no-store' });
  if (!response.ok) throw new Error(`recipes.json konnte nicht geladen werden (${response.status})`);
  state.recipes = await response.json();
  populateFilters();
  render();
}

function populateSelect(select, values) {
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
}

function populateFilters() {
  populateSelect(filters.cuisine, uniq(state.recipes.map((r) => r.cuisine)));
  populateSelect(filters.diet, uniq(state.recipes.map((r) => r.diet)));
  populateSelect(filters.course, uniq(state.recipes.map((r) => r.course)));
  populateSelect(filters.effort, uniq(state.recipes.map((r) => r.effort)));

  const tags = uniq(state.recipes.flatMap((r) => r.tags || []));
  const tagContainer = $('#tagFilters');
  tagContainer.replaceChildren();
  for (const tag of tags) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = tag;
    button.addEventListener('click', () => {
      state.tag = state.tag === tag ? '' : tag;
      renderList();
    });
    tagContainer.append(button);
  }
}

function currentRecipeId() {
  const match = window.location.hash.match(/^#recipe\/(.+)$/);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return '';
  }
}

function showListRoute() {
  if (currentRecipeId()) {
    window.location.hash = '';
  } else {
    renderList();
  }
}

function matches(recipe) {
  const query = normalize(filters.search.value);
  const haystack = normalize([
    recipe.title,
    recipe.description,
    recipe.cuisine,
    recipe.diet,
    recipe.course,
    recipe.effort,
    ...(recipe.tags || []),
    ...(recipe.ingredients || []),
    ...(recipe.steps || []),
  ].join(' '));

  return (!query || haystack.includes(query))
    && (!filters.cuisine.value || recipe.cuisine === filters.cuisine.value)
    && (!filters.diet.value || recipe.diet === filters.diet.value)
    && (!filters.course.value || recipe.course === filters.course.value)
    && (!filters.effort.value || recipe.effort === filters.effort.value)
    && (!state.tag || (recipe.tags || []).includes(state.tag));
}

function setListChromeVisible(visible) {
  controlsEl.hidden = !visible;
  summaryEl.hidden = !visible;
}

function setFiltersExpanded(expanded) {
  filtersPanelEl.hidden = !expanded;
  filtersToggleEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  controlsEl.classList.toggle('is-open', expanded);
}

function metaItems(recipe) {
  return [
    recipe.diet,
    recipe.effort,
    recipe.servings ? `${recipe.servings} Portionen` : '',
    ...(recipe.tags || []),
  ].filter(Boolean);
}

function appendBadges(container, items) {
  for (const item of items) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = item;
    container.append(badge);
  }
}

function formatScaledNumber(value) {
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace('.', ',');
}

function scaleIngredient(ingredient, factor) {
  if (factor === 1) return ingredient;

  const match = ingredient.match(/^(\d+(?:[,.]\d+)?)(\s*)(g|kg|ml|l|TL|EL|Prise|Prisen|Dose|Dosen|Knoblauchzehe|Knoblauchzehen|Zwiebel|Zwiebeln|Ei|Eier)\b(.*)$/i);
  if (!match) return ingredient;

  const [, amount, spacing, unit, rest] = match;
  const scaled = Number(amount.replace(',', '.')) * factor;
  return `${formatScaledNumber(scaled)}${spacing}${unit}${rest}`;
}

function renderIngredients(list, recipe, servings) {
  list.replaceChildren();
  const baseServings = recipe.servings || servings || 1;
  const factor = servings / baseServings;
  for (const ingredient of recipe.ingredients || []) {
    const li = document.createElement('li');
    li.textContent = scaleIngredient(ingredient, factor);
    list.append(li);
  }
}

function createServingsControl(recipe, ingredientsList) {
  const baseServings = recipe.servings || 1;
  const control = document.createElement('div');
  control.className = 'servings-control';
  control.innerHTML = `
    <label class="servings-label" for="servings-input">Portionen</label>
    <div class="servings-stepper">
      <button class="servings-button" type="button" data-step="-1" aria-label="Eine Portion weniger">−</button>
      <input id="servings-input" class="servings-input" type="number" inputmode="numeric" min="1" max="99" step="1" value="${baseServings}" />
      <button class="servings-button" type="button" data-step="1" aria-label="Eine Portion mehr">+</button>
    </div>
  `;

  const input = control.querySelector('.servings-input');
  const update = (nextValue) => {
    const parsed = Number.parseInt(nextValue, 10);
    const servings = Math.min(99, Math.max(1, Number.isFinite(parsed) ? parsed : baseServings));
    input.value = String(servings);
    renderIngredients(ingredientsList, recipe, servings);
  };

  control.querySelectorAll('.servings-button').forEach((button) => {
    button.addEventListener('click', () => {
      update(Number(input.value || baseServings) + Number(button.dataset.step));
    });
  });
  input.addEventListener('input', () => update(input.value));
  input.addEventListener('blur', () => update(input.value));

  return control;
}

function render() {
  const id = currentRecipeId();
  if (id) {
    renderDetail(id);
  } else {
    renderList();
  }
}

function renderList() {
  setListChromeVisible(true);
  const filtered = state.recipes.filter(matches);
  $('#count').textContent = `${filtered.length} ${filtered.length === 1 ? 'Rezept' : 'Rezepte'}`;

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('active', chip.textContent === state.tag);
  });

  recipesEl.className = 'recipes';
  recipesEl.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Keine passenden Rezepte gefunden.';
    recipesEl.append(empty);
    return;
  }

  for (const recipe of filtered) {
    const node = template.content.cloneNode(true);
    const article = node.querySelector('.card');
    const cardLink = node.querySelector('.card-link');
    cardLink.href = recipeUrl(recipe);
    cardLink.setAttribute('aria-label', `${recipe.title} öffnen`);
    node.querySelector('.card-kicker').textContent = [recipe.cuisine, recipe.course].filter(Boolean).join(' · ');
    node.querySelector('h2').textContent = recipe.title;
    node.querySelector('.time').textContent = recipe.time || '—';
    node.querySelector('.description').textContent = recipe.description || '';

    appendBadges(node.querySelector('.meta'), metaItems(recipe));

    recipesEl.append(node);
  }
}

function renderDetail(id) {
  const recipe = state.recipes.find((item) => item.id === id);
  setListChromeVisible(false);
  recipesEl.className = 'recipe-detail-wrap';
  recipesEl.replaceChildren();

  if (!recipe) {
    document.title = 'Rezepte';
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML = '<p>Dieses Rezept wurde nicht gefunden.</p><p><a href="#">Zurück zur Übersicht</a></p>';
    recipesEl.append(empty);
    return;
  }

  document.title = `${recipe.title} · Rezepte`;

  const article = document.createElement('article');
  article.className = 'recipe-detail';

  const back = document.createElement('a');
  back.className = 'back-link';
  back.href = '#';
  back.textContent = '← Zurück zur Übersicht';
  article.append(back);

  const kicker = document.createElement('p');
  kicker.className = 'card-kicker';
  kicker.textContent = [recipe.cuisine, recipe.course].filter(Boolean).join(' · ');
  article.append(kicker);

  const title = document.createElement('h2');
  title.className = 'detail-title';
  title.textContent = recipe.title;
  article.append(title);

  const description = document.createElement('p');
  description.className = 'description detail-description';
  description.textContent = recipe.description || '';
  article.append(description);

  const meta = document.createElement('div');
  meta.className = 'meta detail-meta';
  appendBadges(meta, [recipe.time, ...metaItems(recipe)].filter(Boolean));
  article.append(meta);

  if (recipe.source) {
    const source = document.createElement('p');
    source.className = 'recipe-source';
    const link = document.createElement('a');
    link.href = recipe.source;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Originalrezept öffnen';
    source.append(link);
    article.append(source);
  }

  const grid = document.createElement('div');
  grid.className = 'detail-grid';

  const ingredientsSection = document.createElement('section');
  ingredientsSection.className = 'detail-panel';
  ingredientsSection.innerHTML = '<h3>Zutaten</h3>';
  const ingredients = document.createElement('ul');
  ingredients.className = 'detail-list ingredients-list';
  ingredientsSection.append(createServingsControl(recipe, ingredients));
  renderIngredients(ingredients, recipe, recipe.servings || 1);
  ingredientsSection.append(ingredients);

  const stepsSection = document.createElement('section');
  stepsSection.className = 'detail-panel';
  stepsSection.innerHTML = '<h3>Zubereitung</h3>';
  const steps = document.createElement('ol');
  steps.className = 'detail-list steps-list';
  for (const step of recipe.steps || []) {
    const li = document.createElement('li');
    li.textContent = step;
    steps.append(li);
  }
  stepsSection.append(steps);

  grid.append(ingredientsSection, stepsSection);
  article.append(grid);
  recipesEl.append(article);
}

Object.values(filters).forEach((el) => el.addEventListener('input', showListRoute));
$('#reset').addEventListener('click', () => {
  Object.values(filters).forEach((el) => { el.value = ''; });
  state.tag = '';
  showListRoute();
});
filtersToggleEl.addEventListener('click', () => {
  setFiltersExpanded(filtersPanelEl.hidden);
});
window.addEventListener('hashchange', () => {
  if (!currentRecipeId()) document.title = 'Rezepte';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

setFiltersExpanded(false);

loadRecipes().catch((error) => {
  recipesEl.innerHTML = `<p class="empty">${error.message}</p>`;
});
