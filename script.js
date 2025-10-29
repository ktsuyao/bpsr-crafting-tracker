import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

window.addEventListener('DOMContentLoaded', () => {
  const firebaseConfig = {
    apiKey: "AIzaSyCPvP645N2U4F_vUpzPJpt9xXNYEAE40EA",
    authDomain: "bpsr-crafting-tracker.firebaseapp.com",
    projectId: "bpsr-crafting-tracker",
    storageBucket: "bpsr-crafting-tracker.firebasestorage.app",
    messagingSenderId: "429629474903",
    appId: "1:429629474903:web:af00de89eb7c6843f97b12"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const recipesRef = collection(db, "recipes");

  // DOM Elements
  const matName = document.getElementById('mat-name');
  const matQty = document.getElementById('mat-qty');
  const matNote = document.getElementById('mat-note');
  const matCrafted = document.getElementById('mat-crafted');
  const parentSelect = document.getElementById('parent-select');
  const addBtn = document.getElementById('add-material');
  const preview = document.getElementById('recipe-preview');
  const itemMultiplierInput = document.getElementById('item-multiplier');
  const saveBtn = document.getElementById('save-recipe');
  const resetBtn = document.getElementById('reset-all');
  const materialList = document.getElementById('material-list');
  const mainItemInput = document.getElementById('main-item');
  const recipeSearchInput = document.getElementById('recipe-search');
  const recipeResultsList = document.getElementById('recipe-results');
  const recentList = document.getElementById('recent-recipes');
  const calculateRawBtn = document.getElementById('calculate-raw');
  const craftingListEl = document.getElementById('crafting-list');
  const rawSummaryEl = document.getElementById('raw-material-summary');
  const addToCraftingListBtn = document.getElementById('add-to-crafting-list');
  const matRaw = document.getElementById('mat-raw');


  let recipeTree = [];
  const craftingList = [];

  // Dark mode toggle
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark-mode');
  }
  document.getElementById('toggle-dark').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
  });

  // UUID generator (still used for internal tree nodes)
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // --- Normalization helpers ---
  function preserveTreeQuantities(node) {
    return {
      ...node,
      id: node.id || generateUUID(),
      qty: Number.isFinite(node.qty) ? node.qty : 1,
      crafted: node.crafted || (node.subMaterials && node.subMaterials.length > 0),
      subMaterials: (node.subMaterials || []).map(preserveTreeQuantities)
    };
  }

  function normalizeSubRecipe(node) {
    return {
      ...node,
      id: node.id || generateUUID(),
      qty: 1,
      crafted: true,
      subMaterials: (node.subMaterials || []).map(preserveTreeQuantities)
    };
  }

  // Clear inputs
  function clearMaterialInputs() {
    matName.value = '';
    matQty.value = '';
    matNote.value = '';
    matCrafted.checked = false;
    matRaw.checked = false;
    if (!parentSelect.querySelector('option[value=""]')) {
      const rootOpt = document.createElement('option');
      rootOpt.value = '';
      rootOpt.textContent = '-- Root Level --';
      parentSelect.insertBefore(rootOpt, parentSelect.firstChild);
    }
    parentSelect.value = '';
  }

  // Add material to tree
  async function addMaterialToTree(tree, parentId, material) {
    if (!parentId) {
      tree.push(material);
    } else {
      function findAndInsert(nodeList) {
        for (let node of nodeList) {
          if (node.id === parentId) {
            if (!node.crafted) {
              alert("Cannot add sub-material to a non-crafted item.");
              return;
            }
            node.subMaterials.push(material);
            return;
          }
          findAndInsert(node.subMaterials);
        }
      }
      findAndInsert(tree);
    }

    // Auto-load crafted sub-recipe
    if (material.crafted && material.subMaterials.length === 0) {
      const snapshot = await getDocs(recipesRef);
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.item && data.item.toLowerCase() === material.name.toLowerCase()) {
          // Preserve children exactly as saved
          material.subMaterials = (data.materials || []).map(preserveTreeQuantities);
          // Do NOT override the user-entered qty here
          // material.qty stays as the value typed in Material Entry
        }
      });
    }
  }

  // Render helpers
  function renderTree(tree, depth = 0, multiplier = 1) {
    const lines = [];
    tree.forEach(node => {
      const qty = Number.isFinite(node.qty) ? node.qty : 1;
      const effectiveQty = qty * multiplier;
      const indent = ' '.repeat(depth * 2);
      const hammer = node.crafted ? ' 🛠️' : '';
      const rawIcon = node.raw ? ' 🌱' : '';
      const line = `${indent}- ${node.name} × ${effectiveQty}${hammer}${rawIcon}${node.note ? ` → ${node.note}` : ''}`;
      lines.push(line);
      if (node.subMaterials && node.subMaterials.length > 0) {
        lines.push(renderTree(node.subMaterials, depth + 1, effectiveQty));
      }
    });
    return lines.join('\n');
  }

  function renderMaterialList(tree, container, multiplier = 1) {
    container.innerHTML = '';
    tree.forEach(node => {
      const qty = Number.isFinite(node.qty) ? node.qty : 1;
      const effectiveQty = qty * multiplier;
      const li = document.createElement('li');
      li.textContent = `${node.name} × ${effectiveQty}${node.crafted ? ' 🛠️' : ''}${node.raw ? ' 🌱' : ''}${node.note ? ` → ${node.note}` : ''}`;
      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑️';
      delBtn.style.marginLeft = '1rem';
      delBtn.addEventListener('click', () => {
        deleteMaterialById(node.id, recipeTree);
        updatePreview();
        updateParentOptions();
      });
      li.appendChild(delBtn);
      if (node.subMaterials && node.subMaterials.length > 0) {
        const subUl = document.createElement('ul');
        renderMaterialList(node.subMaterials, subUl, effectiveQty);
        li.appendChild(subUl);
      }
      container.appendChild(li);
    });
  }

  function updatePreview() {
    const multiplier = parseInt(itemMultiplierInput.value.trim(), 10) || 1;
    preview.textContent = renderTree(recipeTree, 0, multiplier);
    renderMaterialList(recipeTree, materialList, multiplier);
  }

  function updateParentOptions() {
    parentSelect.innerHTML = '<option value="">-- Root Level --</option>';
    function addOptions(tree, prefix = '') {
      for (let node of tree) {
        const label = `${prefix}${node.name}`;
        const option = document.createElement('option');
        option.value = node.id;
        option.textContent = label;
        parentSelect.appendChild(option);
        if (node.subMaterials && node.subMaterials.length > 0) {
          addOptions(node.subMaterials, label + ' > ');
        }
      }
    }
    addOptions(recipeTree);
  }

  function deleteMaterialById(id, tree) {
    for (let i = 0; i < tree.length; i++) {
      if (tree[i].id === id) {
        tree.splice(i, 1);
        return true;
      } else {
        if (deleteMaterialById(id, tree[i].subMaterials)) return true;
      }
    }
    return false;
  }

  // Add Material button
  addBtn.addEventListener('click', async () => {
    const name = matName.value.trim();
    const qty = parseInt(matQty.value.trim(), 10) || 1;
    const note = matNote.value.trim();
    const crafted = matCrafted.checked;
    const parentId = parentSelect.value || '';

    if (!name) {
      alert("Please enter a material name.");
      return;
    }

    const newMaterial = {
    id: generateUUID(),
    name,
    qty,
    note,
    crafted,
    raw: matRaw.checked,   // ✅ new field
    subMaterials: []
  };

    await addMaterialToTree(recipeTree, parentId, newMaterial);

    updatePreview();
    updateParentOptions();
    clearMaterialInputs();
    await populateMaterialSuggestions();
  });

  // Multiplier input live update
  itemMultiplierInput.addEventListener('input', () => {
    updatePreview();
  });

  // --- Crafting List & Raw Summary ---
  function renderCraftingList() {
    craftingListEl.innerHTML = '';
    craftingList.forEach(({ recipe, multiplier }, index) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${recipe.item} × <input type="number" value="${multiplier}" min="1" class="craft-qty" data-index="${index}" /></span>
        <button class="remove-craft" data-index="${index}">🗑️</button>
      `;
      craftingListEl.appendChild(li);
    });
    updateRawMaterialSummary();
  }

  craftingListEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-craft')) {
      const index = parseInt(e.target.dataset.index, 10);
      craftingList.splice(index, 1);
      renderCraftingList();
    }
  });

  craftingListEl.addEventListener('input', (e) => {
    if (e.target.classList.contains('craft-qty')) {
      const index = parseInt(e.target.dataset.index, 10);
      const newQty = parseInt(e.target.value, 10);
      if (!isNaN(newQty) && newQty > 0) {
        craftingList[index].multiplier = newQty;
        updateRawMaterialSummary();
      }
    }
  });

  function collectRawMaterials(tree, multiplier = 1, rawMap = {}) {
    tree.forEach(node => {
      const qty = Number.isFinite(node.qty) ? node.qty : 1;
      const effectiveQty = qty * multiplier;
      if (node.crafted && node.subMaterials && node.subMaterials.length > 0) {
        collectRawMaterials(node.subMaterials, effectiveQty, rawMap);
      } else {
        const key = node.name.toLowerCase();
        rawMap[key] = (rawMap[key] || 0) + effectiveQty;
      }
    });
    return rawMap;
  }

  function updateRawMaterialSummary() {
    const rawTotals = {};
    craftingList.forEach(({ recipe, multiplier }) => {
      collectRawMaterials(recipe.materials, multiplier, rawTotals);
    });
    const lines = Object.entries(rawTotals).map(([name, qty]) => `- ${name} × ${qty}`);
    rawSummaryEl.textContent = lines.join('\n');
  }

  // --- Add to Crafting List ---
  addToCraftingListBtn.addEventListener('click', () => {
    const itemName = mainItemInput.value.trim();
    const multiplier = parseInt(itemMultiplierInput.value.trim(), 10) || 1;

    if (!itemName || recipeTree.length === 0) {
      alert("No recipe loaded to add.");
      return;
    }

    const recipeCopy = recipeTree.map(preserveTreeQuantities);
    craftingList.push({ recipe: { item: itemName, materials: recipeCopy }, multiplier });
    renderCraftingList();
  });

  // --- Save crafted sub-recipes with setDoc ---
  async function saveCraftedSubRecipes(tree, savedItems = new Set()) {
    for (let node of tree) {
      const itemKey = node.name.trim().toLowerCase();
      if (!savedItems.has(itemKey)) {
        if (node.crafted && node.subMaterials.length > 0) {
          const subRecipe = {
            item: node.name,
            multiplier: node.qty,
            materials: node.subMaterials,
            crafted: true,
            raw: false,
            timestamp: Timestamp.now()
          };
          await setDoc(doc(db, "recipes", node.name), subRecipe);
          savedItems.add(itemKey);
          await saveCraftedSubRecipes(node.subMaterials, savedItems);
        } else if (node.raw) {
          const rawDoc = {
            item: node.name,
            raw: true,
            timestamp: Timestamp.now()
          };
          await setDoc(doc(db, "recipes", node.name), rawDoc);
          savedItems.add(itemKey);
        }
      }
    }
}

  // --- Save main recipe ---
  saveBtn.addEventListener('click', async () => {
    const itemName = mainItemInput.value.trim() || 'Unnamed Recipe';
    const multiplier = parseInt(itemMultiplierInput.value.trim(), 10) || 1;
    if (!itemName || recipeTree.length === 0) {
      alert("Please enter a recipe name and add at least one material.");
      return;
    }

    const recipe = {
      item: itemName,
      multiplier,
      materials: recipeTree,
      crafted: true,
      timestamp: Timestamp.now()
    };

    await setDoc(doc(db, "recipes", itemName), recipe);
    await saveCraftedSubRecipes(recipeTree, new Set());

    alert(`Recipe "${itemName}" and any new sub-recipes saved.`);
    renderRecentRecipes();
    await populateMaterialSuggestions();
  });

  // --- Reset ---
  resetBtn.addEventListener('click', () => {
    recipeTree = [];
    craftingList.length = 0;
    itemMultiplierInput.value = 1;
    mainItemInput.value = '';
    clearMaterialInputs();
    recipeSearchInput.value = '';
    recipeResultsList.innerHTML = '';
    materialList.innerHTML = '';
    preview.textContent = '';
    rawSummaryEl.textContent = '';
    renderCraftingList();
    updateParentOptions();
  });

  // --- Load recipe by ID (now item name) ---
  async function loadRecipeById(id) {
    const snap = await getDoc(doc(db, "recipes", id));
    if (snap.exists()) {
      const data = snap.data();
      const materials = data.materials || [];

      const isSingleRootSelfRecipe =
        materials.length === 1 &&
        typeof materials[0].name === 'string' &&
        typeof data.item === 'string' &&
        materials[0].name.trim().toLowerCase() === data.item.trim().toLowerCase();

      recipeTree = isSingleRootSelfRecipe
        ? materials.map(normalizeSubRecipe)
        : materials.map(preserveTreeQuantities);

      itemMultiplierInput.value = 1;
      mainItemInput.value = data.item || '';

      updatePreview();
      updateParentOptions();
      recipeSearchInput.value = '';
      recipeResultsList.innerHTML = '';
    }
  }

  // --- Search ---
  recipeSearchInput.addEventListener('input', async (e) => {
    const queryText = e.target.value.trim().toLowerCase();
    const snapshot = await getDocs(recipesRef);
    const matches = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.item && data.item.toLowerCase().includes(queryText)) {
        matches.push({ id: docSnap.id, name: data.item });
      }
    });

    recipeResultsList.innerHTML = '';
    matches.forEach(({ id, name }) => {
      const li = document.createElement('li');
      li.textContent = name;

      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑️';
      delBtn.style.marginLeft = '1rem';
      delBtn.addEventListener('click', async (evt) => {
        evt.stopPropagation();
        const confirmDelete = confirm(`Delete recipe "${name}"?`);
        if (confirmDelete) {
          await deleteDoc(doc(db, "recipes", id));
          alert(`Recipe "${name}" deleted.`);
          recipeSearchInput.dispatchEvent(new Event('input'));
          renderRecentRecipes();
          await populateMaterialSuggestions();
        }
      });

      li.addEventListener('click', () => loadRecipeById(id));
      li.appendChild(delBtn);
      recipeResultsList.appendChild(li);
    });
  });

  // --- Recent ---
  async function renderRecentRecipes() {
    recentList.innerHTML = '';
    const snapshot = await getDocs(query(recipesRef, orderBy("timestamp", "desc"), limit(10)));
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const li = document.createElement('li');
      li.textContent = data.item;
      li.addEventListener('click', () => loadRecipeById(docSnap.id));
      recentList.appendChild(li);
    });
  }

  // --- Suggestions ---
  async function populateMaterialSuggestions() {
    const snapshot = await getDocs(recipesRef);
    const names = new Set();
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.item) names.add(data.item.trim());
    });
    const datalist = document.getElementById('material-suggestions');
    datalist.innerHTML = '';
    [...names].sort().forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      datalist.appendChild(option);
    });
  }

      // --- Suggestions ---
  async function populateMaterialSuggestions() {
    const snapshot = await getDocs(recipesRef);
    const names = new Set();
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data.item) names.add(data.item.trim());
    });
    const datalist = document.getElementById('material-suggestions');
    datalist.innerHTML = '';
    [...names].sort().forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      datalist.appendChild(option);
    });
  }

  // --- Check if crafted/raw ---
  async function checkIfCraftedOrRaw(name) {
    if (!name) return;
    const snap = await getDoc(doc(db, "recipes", name));
    if (snap.exists()) {
      const data = snap.data();
      matCrafted.checked = !!data.crafted && (data.materials?.length > 0);
      matRaw.checked = !!data.raw;
    } else {
      matCrafted.checked = false;
      matRaw.checked = false;
    }
  }

  // Listen to both input and change on the material name field
  matName.addEventListener('input', () => {
    checkIfCraftedOrRaw(matName.value.trim());
  });
  matName.addEventListener('change', () => {
    checkIfCraftedOrRaw(matName.value.trim());
  });

  // --- Init ---
  renderRecentRecipes();
  populateMaterialSuggestions();
});