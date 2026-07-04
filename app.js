const state = {
  recipes: [],
  tag: '',
};

const $ = (selector) => document.querySelector(selector);
const recipesEl = $('#recipes');
const template = $('#recipe-card-template');
const controlsEl = $('.controls');
const summaryEl = $('.result-summary');
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
    node.querySelector('.card-kicker').textContent = [recipe.cuisine, recipe.course].filter(Boolean).join(' · ');
    node.querySelector('h2').textContent = recipe.title;
    node.querySelector('.time').textContent = recipe.time || '—';
    node.querySelector('.description').textContent = recipe.description || '';

    appendBadges(node.querySelector('.meta'), metaItems(recipe));

    const ingredients = node.querySelector('.ingredients');
    for (const ingredient of recipe.ingredients || []) {
      const li = document.createElement('li');
      li.textContent = ingredient;
      ingredients.append(li);
    }

    const steps = node.querySelector('.steps');
    for (const step of recipe.steps || []) {
      const li = document.createElement('li');
      li.textContent = step;
      steps.append(li);
    }

    const openLink = document.createElement('a');
    openLink.className = 'open-recipe';
    openLink.href = recipeUrl(recipe);
    openLink.textContent = 'Detailseite öffnen';
    openLink.setAttribute('aria-label', `${recipe.title} als Detailseite öffnen`);
    article.append(openLink);

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

  const grid = document.createElement('div');
  grid.className = 'detail-grid';

  const ingredientsSection = document.createElement('section');
  ingredientsSection.className = 'detail-panel';
  ingredientsSection.innerHTML = '<h3>Zutaten</h3>';
  const ingredients = document.createElement('ul');
  ingredients.className = 'detail-list ingredients-list';
  for (const ingredient of recipe.ingredients || []) {
    const li = document.createElement('li');
    li.textContent = ingredient;
    ingredients.append(li);
  }
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
window.addEventListener('hashchange', () => {
  if (!currentRecipeId()) document.title = 'Rezepte';
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

loadRecipes().catch((error) => {
  recipesEl.innerHTML = `<p class="empty">${error.message}</p>`;
});
