// Enumerates every route registered on the Express app (Express 4 router internals), so the RBAC matrix test can
// prove that NO endpoint exists without a declared access rule (IPP-SR-006).
const unescape = (s) => s.replace(/\\(.)/g, '$1');

function mountPath(layer) {
  if (layer.regexp.fast_slash) return '';
  const m = layer.regexp
    .toString()
    .replace('\\/?', '')
    .replace('(?=\\/|$)', '$')
    .match(/^\/\^((?:\\[.*+?^${}()|[\]\\/]|[^.*+?^${}()|[\]\\/])*)\$\//);
  if (!m) throw new Error(`Cannot resolve mount path for ${layer.regexp}`);
  return unescape(m[1]);
}

function walk(stack, prefix, out) {
  for (const layer of stack) {
    if (layer.route) {
      Object.keys(layer.route.methods)
        .filter((m) => layer.route.methods[m])
        .forEach((method) => out.add(`${method.toUpperCase()} ${prefix}${layer.route.path}`.replace(/\/+$/, '') || '/'));
    } else if (layer.name === 'router' && layer.handle.stack) {
      walk(layer.handle.stack, prefix + mountPath(layer), out);
    }
  }
}

function listRoutes(app) {
  const out = new Set();
  walk(app._router.stack, '', out);
  return [...out].sort();
}

module.exports = { listRoutes };
