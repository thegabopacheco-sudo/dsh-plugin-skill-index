# Cómo funciona dsh-plugin-skill-index

Indice local de skills para DeepSeek Harness: escanea carpetas con SKILL.md, extrae nombre/descripcion/cuando usarla y permite buscar y leer skills.

## Arquitectura

```
DSH ──MCP stdio──► server.mjs (bundle single-file)
                    └─ lógica local del plugin
```

## Herramientas reales

- `status`: Estado
- `index`: Listar skills
- `search`: Buscar skills
- `get`: Leer skill

## Seguridad

- Lectura por defecto; acciones con `confirm:true`.
- Modo `read-only` por variable de entorno.
- Listas blancas cuando aplique.
- Auditoría en `<DSH_HOME>\cache\skill-index\audit.jsonl`.
- Rate limit de acciones.

## Verificación

Tests end-to-end con el cliente MCP oficial (`@modelcontextprotocol/client@2.2.0`)
y artefacto empaquetado (`npm pack` → `postinstall` → servidor desplegado).
