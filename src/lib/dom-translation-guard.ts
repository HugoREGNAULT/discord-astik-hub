/**
 * Garde anti-crash « removeChild / insertBefore NotFoundError ».
 *
 * Symptôme : `NotFoundError: Failed to execute 'removeChild' on 'Node': The node
 * to be removed is not a child of this node.` → remonte en RouteError
 * (« Cette page n'a pas pu s'afficher »).
 *
 * Cause : quand le navigateur TRADUIT la page (Google Translate / traduction
 * intégrée d'Edge/Chrome, fréquent chez les candidats non-francophones), il
 * remplace des nœuds texte dans le DOM. React, lors d'un démontage de sous-arbre
 * (ex : navigation /me → /candidature), tente alors de retirer/insérer des nœuds
 * qui ne sont plus enfants de leur parent d'origine → exception → crash.
 *
 * Correctif officiel (facebook/react#11538) : rendre removeChild/insertBefore
 * tolérants (no-op si le nœud n'a pas le bon parent) au lieu de lever. La
 * traduction continue de fonctionner ; l'app ne crashe plus.
 *
 * Client-only (pas de DOM au SSR) et idempotent.
 */
export function installDomTranslationGuard(): void {
  if (typeof window === "undefined" || typeof Node === "undefined" || !Node.prototype) {
    return;
  }
  const flag = window as Window & { __domTranslationGuard?: boolean };
  if (flag.__domTranslationGuard) return;
  flag.__domTranslationGuard = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      // Nœud déjà déplacé/retiré par le traducteur : on ignore au lieu de planter.
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      // Référence déplacée par le traducteur : on insère en fin plutôt que de planter.
      return originalInsertBefore.call(this, newNode, null) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}
