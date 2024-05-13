/**
 * Filters an array of objects based on a specific property and key.
 *
 * @param {Object[]} array - Array of objects to be filtered.
 * @param {string} property - Property of each object to check for presence of key.
 * @param {string} key - Key to search for within the specified property.
 * @returns {Object[]} - Array containing only the objects whose specified property includes the given key.
 */
export function filterObjectArray(array, property, key) {
  return array.filter((obj) => {
    return obj[property].includes(key);
  });
}
