/**
 * Electricista360 — entrada de configuración sectorial.
 *
 * El producto standalone solo exporta la vertical electricista. Las antiguas
 * configuraciones de otros negocios permanecen temporalmente en el árbol para
 * una retirada controlada en la fase de limpieza, pero ya no forman parte del
 * runtime público de Electricista360.
 */

export { getVertical, loadVerticalConfig } from "../core/vertical-loader";
export { electricistaConfig } from "./electricista/config";
