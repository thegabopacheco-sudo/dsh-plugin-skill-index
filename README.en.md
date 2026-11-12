# dsh-plugin-skill-index — Skill Index

Indice local de skills para DeepSeek Harness: escanea carpetas con SKILL.md, extrae nombre/descripcion/cuando usarla y permite buscar y leer skills.

## Tools

| Tool | Qué hace |
|---|---|
| `status` | Estado |
| `index` | Listar skills |
| `search` | Buscar skills |
| `get` | Leer skill |

## Instalación

Desde **DSH → Settings → Plugins** instala `github:thegabopacheco-sudo/dsh-plugin-skill-index` y permite el script de instalación.

```
dsh plugin --profile <perfil> add github:thegabopacheco-sudo/dsh-plugin-skill-index
```

## Seguridad

- Lectura por defecto; escritura solo con `confirm:true` y pedido explícito.
- `DSH_SKILL_INDEX_MODE=read-only` desactiva acciones.
- Listas blancas y auditoría en `<DSH_HOME>\cache\skill-index\audit.jsonl`.

## Licencia

MIT © thegabopacheco-sudo
