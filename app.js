const state = {
  recipes: [],
  tag: '',
};

const $ = (selector) => document.querySelector(selector);
const recipesEl = $('#recipes');
const template = $('#recipe-card-template');
const filters = {
  search: $('#search'),
  cuisine: $('#cuisine'),
  diet: $('#diet'),
  course: $('#course'),
  effort: $('#effort'),
};

const normalize = (value) => String(value || '').trim().toLowerCase();
const uniq = (items) => [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));

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
      render();
    });
    tagContainer.append(button);
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
  ].join(' '));

  return (!query || haystack.includes(query))
    && (!filters.cuisine.value || recipe.cuisine === filters.cuisine.value)
    && (!filters.diet.value || recipe.diet === filters.diet.value)
    && (!filters.course.value || recipe.course === filters.course.value)
    && (!filters.effort.value || recipe.effort === filters.effort.value)
    && (!state.tag || (recipe.tags || []).includes(state.tag));
}

function render() {
  const filtered = state.recipes.filter(matches);
  $('#count').textContent = `${filtered.length} ${filtered.length === 1 ? 'Rezept' : 'Rezepte'}`;

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('active', chip.textContent === state.tag);
  });

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
    node.querySelector('.card-kicker').textContent = [recipe.cuisine, recipe.course].filter(Boolean).join(' · ');
    node.querySelector('h2').textContent = recipe.title;
    node.querySelector('.time').textContent = recipe.time || '—';
    node.querySelector('.description').textContent = recipe.description || '';

    const meta = node.querySelector('.meta');
    for (const item of [recipe.diet, recipe.effort, ...(recipe.tags || [])].filter(Boolean)) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = item;
      meta.append(badge);
    }

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

    recipesEl.append(node);
  }
}

Object.values(filters).forEach((el) => el.addEventListener('input', render));
$('#reset').addEventListener('click', () => {
  Object.values(filters).forEach((el) => { el.value = ''; });
  state.tag = '';
  render();
});

loadRecipes().catch((error) => {
  recipesEl.innerHTML = `<p class="empty">${error.message}</p>`;
});
