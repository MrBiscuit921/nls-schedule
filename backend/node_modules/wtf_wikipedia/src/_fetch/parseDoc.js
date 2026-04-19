import Document from '../01-document/Document.js'
import { isArray } from '../_lib/helpers.js'
/**
 * this function puts all responses into proper Document objects
 *
 * @private
 * @param {Array} res
 * @param {string | number | Array<number> | Array<string>} title
 * @returns {null | Document | Document[]} `Document | null` if `title` is scalar, `or Document[]` if `title` is an array
 */
const parseDoc = function (res, title) {
  const results = (res ?? [])
    .filter((o) => o != null)
    .map(o => new Document(o.wiki, o.meta))

  return isArray(title) ? results : results[0] ?? null
}
export default parseDoc
