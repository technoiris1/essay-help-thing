const STORAGE_KEY = "essay-desk-data";

const emptyData = () => ({ universities: [] });

export function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return emptyData();
    const data = JSON.parse(saved);
    return data && Array.isArray(data.universities) ? data : emptyData();
  } catch (error) {
    console.error("Could not load saved essays.", error);
    return emptyData();
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Could not save essays locally.", error);
    throw new Error("Your browser could not save this change. Check available storage.");
  }
}
