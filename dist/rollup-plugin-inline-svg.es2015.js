import { extname } from 'path';

var Regexes = {
  SVG: /(<svg[\w\W]+?<\/svg>)/,
  ATTRS: /\s([\w\W]+?)=["']([\w\W]+?)["']/gm,
  SVG_ATTRS: /(<svg[\w\W]+?>)/,
  WIDTH_ATTR: /<svg[\w\W]+?(width=["'][\w\W]+?["']\s?)[\w\W]+?>/,
  HEIGHT_ATTR: /<svg[\w\W]+?(height=["'][\w\W]+?["']\s?)[\w\W]+?>/m,

  /**
   * Creates regex for attr match
   * @param {string} attr
   * @return {RegExp}
   */
  createRegexForAttributePresence: (attr) => new RegExp(`\\s${attr}=["'][\\w\\W]+?["']`),

  /**
   * Creates regex for tag match
   * @param {string} tag
   * @return {RegExp}
   */
  createRegexForTag: (tag) => new RegExp(`<${tag}[\\w\\W]+?>?[\\w\\W]+?<?\\/${tag}>`, "g")
};

/**
 * Removes `width` and `height` attributes from <svg> tag
 * @param {string} content
 * @return {string}
 */
function removeSVGTagAttrs(content) {
  let match = content.match(Regexes.WIDTH_ATTR);
  /* istanbul ignore else */
  if (match != null) {
    content = content.replace(match[1], "");
  }
  match = content.match(Regexes.HEIGHT_ATTR);
  /* istanbul ignore else */
  if (match != null) {
    content = content.replace(match[1], "");
  }
  return content;
}

/**
 * Extracts attributes from html to object
 * @param {string} html
 * @return {object}
 */
function extractAttributes(html) {
  const attributes = Object.create(null);
  let match;
  while ((match = Regexes.ATTRS.exec(html)) != null) {
    attributes[match[1]] = match[2];
  }
  return attributes;
}

/**
 * Places attributes from object to string
 * @param {object} attributes
 * @return {string}
 */
function placeAttributes(attributes) {
  const keys = Object.keys(attributes);
  return keys.reduce((str, attr) => str += ` ${attr}="${attributes[attr]}"`, "");
}

/**
 * Creates opening svg tag with attributes
 * @param {object} attributes
 */
function createSvg(attributes) {
  return `<svg${placeAttributes(attributes)}>`;
}

/**
 * Removes attributes from html based on forbiddenAttributes array
 * @param {string} content
 * @param {Array.<string>} forbiddenAttributes
 * @return {string}
 */
function removeTagAttrs(content, forbiddenAttributes) {
  const match = content.match(Regexes.SVG_ATTRS);
  /* istanbul ignore else */
  if (match) {
    const svg = match[1];
    const attributes = extractAttributes(svg);
    forbiddenAttributes.forEach(attr => {
      /* istanbul ignore else */
      if (attributes[attr] != null) {
        delete attributes[attr];
      }
    });

    content = content.replace(svg, createSvg(attributes));
  }
  return content;
}

/**
 * Removes nodes with children in `content` by `tag`
 * @param {string} content
 * @param {string} tag
 * @return {string}
 */
function removeForbiddenNode(content, tag) {
  const regex = Regexes.createRegexForTag(tag);
  let match;
  while ((match = regex.exec(content)) != null) {
    content = content.replace(match[0], "");
  }
  return content;
}

/**
 * Removes tags from html based on forbiddenTags array
 * @param {string} content
 * @param {Array.<string>} forbiddenTags
 * @return {string}
 */
function removeTags(content, forbiddenTags) {
  const match = content.match(Regexes.SVG);
  /* istanbul ignore else */
  if (match) {
    const svg = match[1];
    let result = svg;
    forbiddenTags.forEach(tag => {
      result = removeForbiddenNode(result, tag);
    });
    content = content.replace(svg, result);
  }
  return content;
}

/**
 * Checks if svg has an attribute
 * @param {string} svg opening part of svg
 * @param {string} attribute
 */
function hasAttribute(svg, attribute) {
  return svg.match(Regexes.createRegexForAttributePresence(attribute)) != null;
}

/**
 * Checks if svg is containing forbidden attributes and throws a warnings
 * @param {string} id
 * @param {string} content
 * @param {Array.<string>} forbiddenAttributes
 */
function validateSvgAttributes(id, content, forbiddenAttributes) {
  const match = content.match(Regexes.SVG_ATTRS);
  /* istanbul ignore else */
  if (match) {
    const svg = match[1];
    const presentAttributes = [];
    forbiddenAttributes.forEach(attr => {
      /* istanbul ignore else */
      if (hasAttribute(svg, attr)) {
        presentAttributes.push(attr);
      }
    });
    /* istanbul ignore else */
    if (presentAttributes.length > 0) {
      console.warn('rollup-plugin-inline-svg: file ' + id + ' has forbidden attrs: ' + presentAttributes.join(', '));
    }
    return presentAttributes;
  } else return [];
}

/**
 * Cheks if svg has a node
 * @param {string} svg whole svg body
 * @param {string} node
 */
function hasNode(svg, node) {
  return svg.match(Regexes.createRegexForTag(node)) != null;
}

/**
 * Checks if svg is containing forbidden nodes and throws a warnings
 * @param {string} id
 * @param {string} content
 * @param {Array.<string>} forbiddenNodes
 */
function validateSvgNodes(id, content, forbiddenNodes) {
  const match = content.match(Regexes.SVG);
  /* istanbul ignore else */
  if (match) {
    const svg = match[1];
    const presentNodes = [];
    forbiddenNodes.forEach(node => {
      /* istanbul ignore else */
      if (hasNode(svg, node)) {
        presentNodes.push(node);
      }
    });
    /* istanbul ignore else */
    if (presentNodes.length > 0) {
      console.warn('rollup-plugin-inline-svg: file ' + id + ' has forbidden nodes: ' + presentNodes.join(', '));
    }
    return presentNodes;
  } else return [];
}

/**
 *
 * @param {{removeSVGTagAttrs: boolean, removeTags: boolean, removingTags: Array.<string>, warnTags: Array.<string>, warnTagAttrs: Array.<string>, removingTagAttrs: Array.<string>}} options
 * @return {{transform(*, *=): (null|*), name: string}|null|{code: string, map: {mappings: string}}}
 */
function svgInline(options = {}) {
  if (typeof options.removeSVGTagAttrs !== "boolean") options.removeSVGTagAttrs = true;
  if (typeof options.removeTags !== "boolean") options.removeTags = false;
  if (!Array.isArray(options.removingTags)) options.removingTags = ['title', 'desc', 'defs', 'style'];
  if (!Array.isArray(options.warnTags)) options.warnTags = [];
  if (!Array.isArray(options.warnTagAttrs)) options.warnTagAttrs = [];
  if (!Array.isArray(options.removingTagAttrs)) options.removingTagAttrs = [];

  return {
    name: "svgInline",

    transform(code, id) {
      if (!extname(id).endsWith(".svg")) return null;
      else {
        let content = code.trim();
        /* istanbul ignore else */
        if (options.warnTagAttrs) validateSvgAttributes(id, content, options.warnTagAttrs);
        /* istanbul ignore else */
        if (options.warnTags) validateSvgNodes(id, content, options.warnTags);
        if (options.removeSVGTagAttrs) content = removeSVGTagAttrs(content);
        if (options.removingTagAttrs.length > 0) content = removeTagAttrs(content, options.removingTagAttrs);
        if (options.removeTags) content = removeTags(content, options.removingTags);
        return {code: `export default '${content. replace(/(\r\n|\n|\r)/gm,"")}'`, map: {mappings: ''}};
      }
    }
  };
}

export default svgInline;
