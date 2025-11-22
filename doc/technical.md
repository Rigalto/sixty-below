# TECHNICAL REFERENCE

Ce document liste les interfaces publiques (API) des modules implémentés. À fournir à l'IA pour qu'elle utilise correctement les fonctions existantes.

## constant.mjs (layer 0)

* FPS, TILE_SIZE, CHUNK_SIZE, WORLD_WIDTH, WORLD_HEIGHT
* NODES: Object { CLAY: {code...}, ... }
* NODES_LOOKUP: Array[NodeObject]
* TILE_TYPE, TILE_FLAG

## assets.mjs (layer 1)

* loadAssets(): Promise<void>
* resolveAssetData(codeStr): {imgId, sx, sy, sw, sh, isAutoTile}
* IMAGE_FILES: Array[String]

## utils.mjs (layer 1)

### Class EventBus (Singleton: eventBus)

* on(event: string, callback: function): void
* off(event: string, callback: function): void
* emit(event: string, data: any): void


## core.mjs (layer 3)

### Class GameCore (Singleton: gameCore)

* boot(): Promise<void> (Technical init)
* startSession(): Promise<void> (Game start)
* loop(timestamp): void
