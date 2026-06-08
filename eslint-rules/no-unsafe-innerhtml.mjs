/**
 * ESLint — peringatkan innerHTML/outerHTML dengan data dinamis.
 * Literal string / template tanpa ekspresi dianggap aman (HTML statis).
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
      'sigajiEmptyState',
      'sigajiSetTbodyRows',
      'sigajiEmptyIllustSvg',
      'sigajiDataAction',
    ]);

    function isSafeHtmlExpression(node) {
      if (!node) return false;
      switch (node.type) {
        case 'Literal':
          return typeof node.value === 'string' || node.value === '';
        case 'TemplateLiteral':
          return node.expressions.length === 0;
        case 'CallExpression': {
          const callee = node.callee;
          if (callee.type === 'Identifier' && SAFE_CALLEES.has(callee.name)) return true;
          if (
            callee.type === 'MemberExpression' &&
            callee.property.type === 'Identifier' &&
            callee.property.name === 'bind' &&
            callee.object.type === 'Identifier' &&
            SAFE_CALLEES.has(callee.object.name)
          ) {
            return true;
          }
          return false;
        }
        case 'ConditionalExpression':
          return (
            isSafeHtmlExpression(node.consequent) && isSafeHtmlExpression(node.alternate)
          );
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
