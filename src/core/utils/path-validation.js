/**
 * Path validation utilities for operation editing
 */

/**
 * Validates a path string according to OpenAPI specifications
 * @param {string} path - The path to validate
 * @returns {Object} - { isValid: boolean, error: string|null }
 */
export const validatePath = (path) => {
  if (!path || path.trim() === '') {
    return { isValid: false, error: 'Path cannot be empty' }
  }

  // Check if path starts with /
  if (!path.startsWith('/')) {
    return { isValid: false, error: 'Path must start with /' }
  }

  // Check for valid characters (alphanumeric, hyphens, underscores, slashes, dots, and curly braces for path parameters)
  const validPathRegex = /^\/[a-zA-Z0-9\/\-_.{}]*$/
  if (!validPathRegex.test(path)) {
    return { isValid: false, error: 'Path contains invalid characters' }
  }

  // Check for proper path parameter syntax {param}
  const openBraces = (path.match(/\{/g) || []).length
  const closeBraces = (path.match(/\}/g) || []).length
  
  if (openBraces !== closeBraces) {
    return { isValid: false, error: 'Path parameters must be properly closed with }' }
  }

  return { isValid: true, error: null }
}

/**
 * Checks if an operation already exists at the given path and method
 * @param {Object} specSelectors - The spec selectors object
 * @param {string} path - The path to check
 * @param {string} method - The method to check
 * @returns {boolean} - True if operation exists, false otherwise
 */
export const checkOperationExists = (specSelectors, path, method) => {
  const spec = specSelectors.specJson()
  return !!spec.getIn(["paths", path, method])
}
