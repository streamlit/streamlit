declare module '*.png';
declare module '*.jpg';
declare module '*.gif';
declare module '*.svg';

// We don't have typings for deck.gl, so let's make it untyped.
declare module "deck.gl"

declare module "@deck.gl/json"

declare module "@deck.gl/layers"

declare module "@deck.gl/aggregation-layers"

declare module "@deck.gl/geo-layers"

declare module "@deck.gl/mesh-layers"

declare module "@loaders.gl/core"

declare module "@loaders.gl/csv"

declare module "@loaders.gl/gltf"

declare module "fzy.js" {
  export function score(pattern: string, subject: string): number
  export function positions(pattern: string, subject: string): Array<number>
  export function hasMatch(pattern: string, subject: string): boolean
}