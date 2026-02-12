import{c as t,A as r}from"./index-Clb-55uW.js";
/**
 * @license lucide-react v0.553.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const n=t("map-pin",[["path",{d:"M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",key:"1r0f0z"}],["circle",{cx:"12",cy:"10",r:"3",key:"ilqhr7"}]]);async function e(){const t=await async function(t){return fetch(t,{credentials:"include",headers:{"Content-Type":"application/json"}})}(`${r}/api/tiers/my-progress/`);if(!t.ok)throw new Error("Failed to fetch tier progress");return t.json()}async function a(){const t=await fetch(`${r}/api/tiers/founding-status/`);if(!t.ok)throw new Error("Failed to fetch founding status");return t.json()}async function o(t){const n=await fetch(`${r}/api/tiers/creator/${t}/`);if(!n.ok)throw new Error("Failed to fetch creator tier");return n.json()}export{n as M,a,o as b,e as g};
