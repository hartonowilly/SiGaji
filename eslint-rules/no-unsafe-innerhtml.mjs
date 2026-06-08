/**
 * ESLint — peringatkan innerHTML/outerHTML dengan data dinamis.
 * Aman: literal, template statis, rangkaian escapeHtml/fmt/ini, atau helper render.
 */
/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Discourage dynamic innerHTML without escapeHtml',
    },
    messages: {
      unsafe:
        'innerHTML/outerHTML dengan data dinamis — bungkus input user/API dengan escapeHtml() atau helper render aman.',
    },
    schema: [],
  },
  create(context) {
    const SAFE_CALLEES = new Set([
      'escapeHtml',
      'escapeAttr',
      'escNik',
      'escKar',
      'sigajiEmptyState',
      'sigajiSetTbodyRows',
      'sigajiEmptyIllustSvg',
      'sigajiDataAction',
      'fmt',
      'fmtDate',
      'ini',
      'terbilangRupiah',
      'String',
      'Number',
      'Math',
    ]);

    function calleeName(node) {
      if (!node) return '';
      if (node.type === 'Identifier') return node.name;
      if (node.type === 'MemberExpression' && node.property.type === 'Identifier') {
        return node.property.name;
      }
      return '';
    }

    const SAFE_HTML_VARS = new Set(['h', 'hb', 'html', 'thead', 'parts', 'rows', 'tableHtml']);

    function isMapJoinCall(node) {
      if (!node || node.type !== 'CallExpression') return false;
      if (node.callee.type !== 'MemberExpression') return false;
      if (node.callee.property.name !== 'join') return false;
      const inner = node.callee.object;
      return (
        inner &&
        inner.type === 'CallExpression' &&
        inner.callee.type === 'MemberExpression' &&
        inner.callee.property.name === 'map'
      );
    }

    function isSafeVarJoinCall(node) {
      if (!node || node.type !== 'CallExpression') return false;
      const cal = node.callee;
      return (
        cal.type === 'MemberExpression' &&
        cal.property.type === 'Identifier' &&
        cal.property.name === 'join' &&
        cal.object.type === 'Identifier' &&
        SAFE_HTML_VARS.has(cal.object.name)
      );
    }

    function isSafeCall(node) {
      if (!node || node.type !== 'CallExpression') return false;
      const name = calleeName(node.callee);
      if (SAFE_CALLEES.has(name)) return true;
      if (isMapJoinCall(node)) return true;
      if (isSafeVarJoinCall(node)) return true;
      if (
        node.callee.type === 'MemberExpression' &&
        node.callee.property.name === 'join' &&
        node.callee.object.type === 'ArrayExpression'
      ) {
        return node.callee.object.elements.every(
          (el) => !el || isSafeHtmlExpression(el)
        );
      }
      return false;
    }

    function isSafeHtmlExpression(node) {
      if (!node) return false;
      switch (node.type) {
        case 'Literal':
          return typeof node.value === 'string' || node.value === '';
        case 'TemplateLiteral':
          return node.expressions.every((ex) => isSafeHtmlExpression(ex));
        case 'CallExpression':
          return isSafeCall(node);
        case 'BinaryExpression':
          if (node.operator !== '+') return false;
          return (
            isSafeHtmlExpression(node.left) && isSafeHtmlExpression(node.right)
          );
        case 'ConditionalExpression':
          return (
            isSafeHtmlExpression(node.consequent) &&
            isSafeHtmlExpression(node.alternate)
          );
        case 'LogicalExpression':
          return (
            isSafeHtmlExpression(node.left) && isSafeHtmlExpression(node.right)
          );
        case 'MemberExpression':
          return (
            node.property.type === 'Identifier' &&
            node.property.name === 'join' &&
            node.object.type === 'Identifier' &&
            SAFE_HTML_VARS.has(node.object.name)
          );
        case 'Identifier':
          return SAFE_HTML_VARS.has(node.name);
        default:
          return false;
      }
    }

    function checkHtmlAssign(left, right) {
      if (!left || left.type !== 'MemberExpression') return;
      const prop = left.property;
      if (prop.type !== 'Identifier') return;
      if (prop.name !== 'innerHTML' && prop.name !== 'outerHTML') return;
      if (isSafeHtmlExpression(right)) return;
      context.report({ node: left, messageId: 'unsafe' });
    }

    return {
      AssignmentExpression(node) {
        checkHtmlAssign(node.left, node.right);
      },
    };
  },
};
