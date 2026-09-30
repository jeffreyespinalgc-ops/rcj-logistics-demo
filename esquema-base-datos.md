# Esquema de base de datos — TALLER RCJ LOGISTICS

Este documento traduce el modelo de datos que ya usa la aplicación (hoy guardado en `localStorage` del
navegador, como prototipo) a un esquema relacional listo para una base de datos real (PostgreSQL, MySQL/
MariaDB o SQL Server — el diseño es estándar y no depende de un motor en particular).

Cada tabla de aquí corresponde a un tipo de `src/types/index.ts` o a una pieza de estado de
`AppContext.tsx` / `AuthContext.tsx` (el nombre original en inglés del código queda entre paréntesis, para
ubicarlo fácil en el proyecto). Donde el prototipo actual guarda una lista anidada dentro de otro registro
(por ejemplo las fotos de un activo, o las firmas de una requisa), aquí queda como su propia tabla
relacionada por llave foránea.

## Índice de tablas (21)

| # | Tabla | Módulo |
|---|-------|--------|
| 1 | `usuarios` | Autenticación |
| 2 | `permisos` | Autenticación |
| 3 | `permisos_rol` | Autenticación |
| 4 | `activos` | Vehículos |
| 5 | `fotos_activo` | Vehículos |
| 6 | `historial_activo` | Vehículos |
| 7 | `repuestos` | Repuestos e Inventario |
| 8 | `movimientos_inventario` | Repuestos e Inventario |
| 9 | `tipos_trabajo` | Catálogo de planes de mantenimiento |
| 10 | `nodos_plan_mantenimiento` | Catálogo de planes de mantenimiento |
| 11 | `ordenes_trabajo` | Órdenes de Trabajo |
| 12 | `historial_ot` | Órdenes de Trabajo |
| 13 | `lineas_ot` | Órdenes de Trabajo |
| 14 | `ruta_linea_ot` | Órdenes de Trabajo |
| 15 | `actividades_linea_ot` | Órdenes de Trabajo |
| 16 | `repuestos_linea_ot` | Órdenes de Trabajo |
| 17 | `fotos_linea_ot` | Órdenes de Trabajo |
| 18 | `requisas_linea` | Requisas de Repuestos |
| 19 | `firmas_requisa` | Requisas de Repuestos |
| 20 | `cargas_combustible` | Combustible |
| 21 | `notificaciones` | Notificaciones |

## ¿Está normalizado? (respuesta corta: ahora sí, hasta 3FN)

- **1FN (valores atómicos)**: ✅. La única columna que no cumplía era `lineas_ot.ruta_trabajo` (guardaba un
  arreglo en una sola celda) — se separó en la tabla `ruta_linea_ot`, un registro por nivel.
- **2FN (sin dependencia parcial de una llave compuesta)**: ✅ ya se cumplía. Solo `permisos_rol` tiene
  llave compuesta (`rol`, `codigo_permiso`) y no tiene columnas adicionales que puedan depender solo de
  una parte de esa llave.
- **3FN (sin dependencia transitiva, cada columna depende de la llave y solo de la llave)**: ahora ✅. Se
  quitaron las columnas que eran copia de otra tabla sin aportar nada propio: `codigo_activo`/
  `nombre_activo` en `ordenes_trabajo` y `cargas_combustible`, y `codigo_repuesto`/`descripcion_repuesto`
  en `movimientos_inventario` y `repuestos_linea_ot`. Esos datos ahora se obtienen por JOIN contra
  `activos`/`repuestos`.
- **Lo que se queda pareciendo "duplicado" pero NO es una violación**: `repuestos_linea_ot.costo_unitario`.
  No es una copia de `repuestos.costo_unitario`, es un hecho propio de esa transacción (cuánto costó ESE
  repuesto en ESA línea, en ESE momento). Si se quitara y se reemplazara por un JOIN al costo actual del
  repuesto, el costo histórico de órdenes ya cerradas cambiaría cada vez que el precio del repuesto se
  actualice — eso sí sería un error real, no una mejora. Es el mismo principio que el precio unitario en
  una línea de factura: se guarda aparte a propósito. Lo mismo pasa con `firmas_requisa.firma_imagen` e `historial_ot.firma_imagen`: son la firma tal como estaba al firmar, para que un documento ya firmado no cambie si el usuario rehace su firma después.

## Convenciones usadas en todo el esquema

- **Llaves primarias**: `id` tipo `UUID` (o `VARCHAR(30)` si se prefiere seguir generando ids como hoy,
  con prefijo + contador). Las tablas que hoy son un objeto embebido sin id propio (`historial_ot`,
  `firmas_requisa`) reciben un `id` nuevo, autogenerado.
- **Fechas/horas**: `TIMESTAMPTZ` (con zona horaria). Hoy la app las guarda como texto ISO; el cambio es
  directo.
- **Dinero**: `DECIMAL(12,2)`, en Lempiras.
- **Enums**: se listan como `ENUM(...)`; en motores sin tipo enum nativo (MySQL sí lo tiene, SQL Server
  no) se implementan como `VARCHAR` + `CHECK` o como tabla catálogo aparte.
- **Snapshot legítimo (no es duplicación)**: `repuestos_linea_ot.costo_unitario` guarda el costo real de
  esa transacción, no una copia del precio actual del repuesto — ver la sección "¿Está normalizado?" más
  arriba.
- Los tipos SQL (`UUID`, `VARCHAR`, `BOOLEAN`, `ENUM`, etc.), y las siglas `PK`/`FK`, se dejan igual que en
  cualquier motor de base de datos — no se traducen, son estándar del lenguaje SQL.

---

## 1. Autenticación y permisos

### `usuarios`
*(`AppUser` en types/index.ts)*

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| usuario | VARCHAR(50) | NO | UNIQUE, nombre de acceso (`username`) |
| contrasena_hash | VARCHAR(255) | NO | ⚠️ hoy la app guarda la contraseña en texto plano (`password`); en producción debe guardarse con hash (bcrypt/argon2), nunca el valor original |
| nombre | VARCHAR(120) | NO | nombre visible, el que firma documentos |
| rol | ENUM('administrador','jefe_taller','control_inventario','tecnico') | NO | |
| activo | BOOLEAN | NO | DEFAULT true |
| firma_imagen | TEXT | SÍ | firma manuscrita del usuario (imagen PNG). Se registra de forma obligatoria en el primer ingreso y se puede rehacer desde el botón "Mi firma" del encabezado. Hoy es un data URL base64; en producción, una referencia a almacenamiento de archivos (igual que las fotos) |
| creado_en | TIMESTAMPTZ | NO | DEFAULT now() |

*(La sesión activa, `Session` en types/index.ts, no es una tabla: en un backend real se reemplaza por un
JWT o una sesión de servidor, no por un registro persistente por login.)*

### `permisos`
*(`Permission` en lib/permissions.ts)* — catálogo fijo de los ~50 permisos del sistema. No lo edita el
usuario final, solo Administración activa/desactiva cuáles tiene cada rol.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| codigo | VARCHAR(60) | NO | PK, ej. `ot.aprobar`, `requisa.despachar` |
| etiqueta | VARCHAR(160) | NO | descripción legible (la que se ve en Administración) |
| titulo_grupo | VARCHAR(80) | NO | agrupador visual, ej. "Ordenes de Trabajo" |

### `permisos_rol`
*(`PermissionMatrix` en lib/permissions.ts)* — reemplaza `defaultPermissions` (hoy un solo objeto en
memoria); con esta tabla cada rol puede tener sus permisos editados y guardados de verdad.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| rol | ENUM(...) | NO | PK compuesta (rol, codigo_permiso) |
| codigo_permiso | VARCHAR(60) | NO | FK → `permisos.codigo`, PK compuesta |

---

## 2. Vehículos (Activos)

### `activos`
*(`Asset`)*

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| codigo | VARCHAR(30) | NO | UNIQUE, ej. `A-001` |
| nombre | VARCHAR(120) | NO | |
| tipo | ENUM('vehiculo_ligero','vehiculo_pesado','maquinaria','equipo_auxiliar') | NO | |
| ubicacion | VARCHAR(120) | NO | |
| estado | ENUM('operativo','en_mantenimiento','fuera_de_servicio','baja') | NO | |
| ultimo_mantenimiento | DATE | SÍ | |
| codigo_sap | VARCHAR(40) | SÍ | código del ERP SAP cuando está vinculado |
| sap_sincronizado | BOOLEAN | NO | DEFAULT false |
| ultima_sincronizacion_en | TIMESTAMPTZ | SÍ | |
| marca | VARCHAR(60) | NO | |
| modelo | VARCHAR(60) | NO | |
| anio | SMALLINT | NO | |
| placa | VARCHAR(20) | NO | |
| motor | VARCHAR(60) | SÍ | número de motor |
| chasis | VARCHAR(60) | SÍ | número de chasis |
| odometro | INTEGER | NO | DEFAULT 0 |
| fecha_adquisicion | DATE | SÍ | |
| costo_adquisicion | DECIMAL(12,2) | SÍ | |

### `fotos_activo`
*(`AssetPhoto`)*

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| activo_id | UUID | NO | FK → `activos.id` |
| clave_almacenamiento | TEXT | NO | hoy es un `dataUrl` base64 embebido; en producción debe ser una referencia a almacenamiento de archivos (S3, Blob, etc.), no el binario en la fila |
| nombre | VARCHAR(200) | NO | nombre original del archivo |
| agregado_en | TIMESTAMPTZ | NO | |

### `historial_activo`
*(`AssetHistoryEntry`)* — bitácora de eventos de un activo (se arma sola al crear una OT, un movimiento
de inventario o una carga de combustible relacionados a ese activo).

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| activo_id | UUID | NO | FK → `activos.id` |
| fecha | DATE | NO | |
| tipo | ENUM('ot','movimiento','carga_combustible') | NO | |
| descripcion | VARCHAR(300) | NO | |
| referencia | VARCHAR(60) | NO | código de la OT/movimiento/carga relacionada |

---

## 3. Repuestos e Inventario

### `repuestos`
*(`Part`)*

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| codigo | VARCHAR(30) | NO | UNIQUE, ej. `REP-001` |
| descripcion | VARCHAR(200) | NO | |
| categoria | VARCHAR(80) | SÍ | |
| stock_actual | INTEGER | NO | DEFAULT 0 |
| stock_minimo | INTEGER | NO | DEFAULT 0 |
| stock_maximo | INTEGER | NO | DEFAULT 0 |
| costo_unitario | DECIMAL(12,2) | NO | |
| bodega | VARCHAR(80) | SÍ | |
| ubicacion | VARCHAR(80) | SÍ | ubicación física dentro de la bodega |

### `movimientos_inventario`
*(`InventoryMovement`)*

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| repuesto_id | UUID | NO | FK → `repuestos.id` (código y descripción se obtienen por JOIN, ya no se duplican aquí) |
| tipo | ENUM('entrada','salida') | NO | |
| cantidad | INTEGER | NO | |
| motivo | VARCHAR(200) | SÍ | |
| referencia | VARCHAR(60) | SÍ | ej. código de la requisa u OT que generó el movimiento |
| usuario_id | UUID | SÍ | FK → `usuarios.id`; hoy la app solo guarda el nombre en texto |
| fecha | TIMESTAMPTZ | NO | |

---

## 4. Catálogo de planes de mantenimiento

### `tipos_trabajo`
*(`CatalogItem`, usado como "Tipos de Trabajo de la OT")*

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| codigo | VARCHAR(30) | NO | UNIQUE |
| nombre | VARCHAR(120) | NO | ej. "Mantenimiento Preventivo" |
| descripcion | VARCHAR(300) | SÍ | |
| activo | BOOLEAN | NO | DEFAULT true |

### `nodos_plan_mantenimiento`
*(`MaintenanceTreeNode`)* — árbol de niveles y actividades de cada tipo de trabajo (auto-referenciado:
cada nodo apunta a su padre). Un nodo sin hijos es una actividad marcable con checkbox; un nodo con hijos
es un nivel intermedio del plan (marca, modelo, intervalo de horas, etc., según lo arme cada
administrador — la profundidad no es fija).

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| tipo_trabajo_id | UUID | NO | FK → `tipos_trabajo.id`; se repite en todos los nodos del árbol, aunque no sean raíz, para poder consultar "todo el plan de este tipo de trabajo" sin recorrer el árbol |
| padre_id | UUID | SÍ | FK → `nodos_plan_mantenimiento.id`; NULL en los nodos raíz |
| nombre | VARCHAR(160) | NO | |
| orden | SMALLINT | NO | DEFAULT 0, orden de aparición entre hermanos |

---

## 5. Órdenes de Trabajo

### `ordenes_trabajo`
*(`WorkOrder`)*

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| codigo | VARCHAR(30) | NO | UNIQUE, ej. `OT-2026-0001` |
| activo_id | UUID | NO | FK → `activos.id` (código y nombre del vehículo se obtienen por JOIN) |
| prioridad | ENUM('baja','media','alta','critica') | NO | |
| estado | ENUM('creada','pendiente_aprobacion','aprobada','en_ejecucion','finalizada','cerrada','rechazada') | NO | `rechazada` es terminal, no vuelve a `creada` |
| descripcion | VARCHAR(500) | NO | |
| creado_en | TIMESTAMPTZ | NO | |
| creado_por | UUID | NO | FK → `usuarios.id` |
| asignado_a | VARCHAR(120) | SÍ | nombre del técnico o del taller externo |
| tipo_asignado | ENUM('tecnico','taller_externo') | SÍ | |
| cerrado_en | TIMESTAMPTZ | SÍ | |
| aprobado_por | UUID | SÍ | FK → `usuarios.id` |
| firmado_por | VARCHAR(120) | SÍ | firma del técnico al finalizar todas las líneas |
| firmado_por_inventario | VARCHAR(120) | SÍ | firma de Control de Inventario sobre el documento de la OT; independiente del cierre |
| firmado_por_inventario_en | TIMESTAMPTZ | SÍ | |
| motivo_rechazo | VARCHAR(500) | SÍ | solo cuando `estado = 'rechazada'` |
| costo_estimado | DECIMAL(12,2) | NO | DEFAULT 0 |

### `historial_ot`
*(`OTHistoryEntry`)* — cada cambio de etapa de la OT, para la línea de tiempo.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| orden_trabajo_id | UUID | NO | FK → `ordenes_trabajo.id` |
| estado | ENUM(igual que `ordenes_trabajo.estado`) | NO | |
| fecha_hora | TIMESTAMPTZ | NO | |
| realizado_por | VARCHAR(120) | NO | quién hizo el cambio |
| rol | ENUM('administrador','jefe_taller','control_inventario','tecnico') | NO | |
| firma_imagen | TEXT | SÍ | copia de la firma guardada de `realizado_por` tal como estaba en ese momento; es la que se imprime en el documento de la OT (Técnico al finalizar, Jefe de Taller al cerrar). No cambia si el usuario rehace su firma después |

### `lineas_ot`
*(`OTLine`)* — unidad independiente de ejecución dentro de una OT.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| orden_trabajo_id | UUID | NO | FK → `ordenes_trabajo.id` |
| trabajo | VARCHAR(300) | NO | descripción final; en líneas de texto libre es la única fuente de verdad (no hay plan detrás), en líneas con plan es la ruta ya armada para mostrarla rápido sin reconstruirla desde `ruta_linea_ot` |
| estado | ENUM('pendiente','en_ejecucion','esperando_repuesto','completado','completado_con_observaciones','no_completado','requiere_seguimiento') | NO | |
| tecnico | VARCHAR(120) | SÍ | se infiere solo si la OT esta asignada a un taller externo |
| iniciado_en | TIMESTAMPTZ | SÍ | |
| finalizado_en | TIMESTAMPTZ | SÍ | |
| horas | DECIMAL(6,2) | NO | DEFAULT 0, calculado entre iniciado_en y finalizado_en |
| notas | VARCHAR(1000) | SÍ | |
| requiere_repuesto | BOOLEAN | NO | DEFAULT false |
| es_hallazgo | BOOLEAN | NO | DEFAULT false |
| estado_hallazgo | ENUM('no_aplica','pendiente','aprobada','rechazada') | NO | DEFAULT 'no_aplica' |
| creado_en | TIMESTAMPTZ | NO | |

### `ruta_linea_ot`
*(antes era `lineas_ot.work_path`, un array JSON — se separa en su propia tabla para que cada valor sea
atómico, como pide la 1FN)* — un registro por nivel de la ruta elegida en el plan de mantenimiento.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| linea_ot_id | UUID | NO | FK → `lineas_ot.id` |
| profundidad | SMALLINT | NO | 0 = tipo de trabajo, 1 = primer nivel del plan, 2 = segundo nivel, etc. |
| nombre | VARCHAR(160) | NO | nombre del nivel en el momento en que se eligió (ver nota 3 más abajo: es una copia a propósito, no una FK a `nodos_plan_mantenimiento`) |

### `actividades_linea_ot`
*(`OTActivity`)* — actividades del plan de mantenimiento marcadas para esta línea.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| linea_ot_id | UUID | NO | FK → `lineas_ot.id` |
| nombre | VARCHAR(200) | NO | |
| orden | SMALLINT | NO | DEFAULT 0 |

### `repuestos_linea_ot`
*(`OTLinePart`)*

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| linea_ot_id | UUID | NO | FK → `lineas_ot.id` |
| repuesto_id | UUID | NO | FK → `repuestos.id` (código y descripción se obtienen por JOIN) |
| cantidad | INTEGER | NO | cantidad SOLICITADA |
| cantidad_entregada | INTEGER | SÍ | lo que Control de Inventario entregó; puede ser menos que lo solicitado por falta de stock (la requisa lo muestra como "2 / 5"). NULL mientras no se entregue. Solo esto descuenta stock y cuenta para el costo |
| costo_unitario | DECIMAL(12,2) | NO | costo real que se cobró en ESTE uso — no es una copia de `repuestos.costo_unitario`, es un hecho propio de la transacción (si el precio del repuesto cambia después, esta línea ya ejecutada no debe cambiar); por eso sí se queda, no es una violación de 3FN |

### `fotos_linea_ot`
*(`OTLinePhoto`)* — la "Evidencia" fotográfica de la línea. La app ya no maneja fotos del "Después": solo existe la evidencia (grupo `antes`); el grupo `despues` se conserva únicamente para no perder datos anteriores.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| linea_ot_id | UUID | NO | FK → `lineas_ot.id` |
| grupo_foto | ENUM('antes','despues') | NO | reemplaza los arrays separados `photosBefore`/`photosAfter`. `antes` = "Evidencia" (lo único que se crea hoy); `despues` solo en datos anteriores |
| clave_almacenamiento | TEXT | NO | igual que `fotos_activo.clave_almacenamiento`: hoy es base64 embebido, en producción debe ser una referencia a almacenamiento de archivos |
| nombre | VARCHAR(200) | NO | |
| agregado_en | TIMESTAMPTZ | NO | |

---

## 6. Requisas de Repuestos

### `requisas_linea`
*(`LineRequisition`)* — una requisa nace cuando una línea marca "Requiere repuesto" y elige repuestos;
relación 1 a 1 con la línea que la generó.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| linea_ot_id | UUID | NO | FK → `lineas_ot.id`, UNIQUE (una requisa por línea) |
| codigo | VARCHAR(30) | NO | UNIQUE, ej. `REQ-2026-0001` |
| liberado_en | TIMESTAMPTZ | SÍ | cuando Control de Inventario aprobó y entregó los repuestos (ahí se descuenta el stock, solo de lo entregado) |
| recepcion_requerida | BOOLEAN | NO | DEFAULT true. Es false solo en requisas que ya se habían entregado antes de existir la firma "Recibido por" (quedan completas al entregarse) |

### `firmas_requisa`
*(`RequisitionSignature`)* — las 4 firmas en orden estricto: solicitante → autoriza → despacha → recibe. En el documento se llaman "Solicitado por" (técnico), "Autorizado por" (Jefe de Taller), "Aprobado por" (Control de Inventario) y "Recibido por" (técnico); el campo "Entregado a" sale de `entregado_a`.

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| requisa_id | UUID | NO | FK → `requisas_linea.id` |
| paso | ENUM('solicitante','autoriza','despacha','recibe') | NO | UNIQUE junto con `requisa_id` (una firma por paso) |
| rol | ENUM('administrador','jefe_taller','control_inventario','tecnico') | NO | rol de quien firmó |
| nombre | VARCHAR(120) | NO | |
| fecha_hora | TIMESTAMPTZ | NO | |
| firma_imagen | TEXT | SÍ | copia de la firma guardada de quien firmó, tal como estaba al firmar |
| entregado_a | VARCHAR(120) | SÍ | solo en el paso `despacha`: el técnico a quien Control de Inventario entregó los repuestos (campo "Entregado a") |

---

## 7. Combustible

### `cargas_combustible`
*(`FuelLoad`)*

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| activo_id | UUID | NO | FK → `activos.id` (código y nombre del vehículo se obtienen por JOIN) |
| fecha | DATE | NO | |
| litros | DECIMAL(8,2) | NO | |
| tipo_combustible | ENUM('diesel','gasolina_87','gasolina_91','gasolina_95') | NO | |
| costo | DECIMAL(12,2) | NO | |
| odometro | INTEGER | NO | |
| proveedor | VARCHAR(120) | SÍ | |
| precio_unitario | DECIMAL(8,2) | NO | |

---

## 8. Notificaciones

### `notificaciones`
*(`AppNotification`)*

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| id | UUID | NO | PK |
| tipo | ENUM('aprobacion','firma','hallazgo','bajo_stock','ot_vencida') | NO | |
| titulo | VARCHAR(200) | NO | |
| descripcion | VARCHAR(500) | SÍ | |
| fecha | DATE | NO | |
| referencia | VARCHAR(60) | SÍ | código de la OT/repuesto/etc. relacionado |
| leido | BOOLEAN | NO | DEFAULT false |
| prioridad | ENUM('alta','media','baja') | NO | |
| usuario_id | UUID | SÍ | FK → `usuarios.id`; hoy las notificaciones son globales (las ve cualquiera con acceso al módulo), no por usuario — se deja la columna lista por si se vuelven personales |

---

## Relaciones principales (resumen)

```
usuarios ─┬─< permisos_rol >─ permisos
          ├─< ordenes_trabajo (creado_por, aprobado_por)
          └─< movimientos_inventario (usuario_id)

activos ─┬─< fotos_activo
         ├─< historial_activo
         ├─< ordenes_trabajo
         └─< cargas_combustible

tipos_trabajo ─< nodos_plan_mantenimiento (auto-referenciada por padre_id)

repuestos ─┬─< movimientos_inventario
           └─< repuestos_linea_ot

ordenes_trabajo ─┬─< historial_ot
                 └─< lineas_ot ─┬─< ruta_linea_ot
                                 ├─< actividades_linea_ot
                                 ├─< repuestos_linea_ot
                                 ├─< fotos_linea_ot
                                 └─< requisas_linea ─< firmas_requisa
```

## Notas para cuando se implemente

1. **Contraseñas**: `usuarios.contrasena_hash` debe guardar un hash (bcrypt/argon2), nunca la contraseña
   tal cual — el prototipo actual la guarda en texto plano solo porque es una demo local.
2. **Fotos**: tanto `fotos_activo` como `fotos_linea_ot` guardan hoy la imagen completa como base64 en el
   propio registro. Eso funciona en `localStorage` pero no escala en una base de datos real; lo normal es
   subir el archivo a almacenamiento de objetos (S3, Azure Blob, etc.) y guardar solo la referencia
   (`clave_almacenamiento`/URL).
3. **`ruta_linea_ot` guarda nombres, no ids**: aunque ya es una tabla propia (en 1FN), sus filas guardan
   `nombre` como texto en vez de una FK a `nodos_plan_mantenimiento`. Es a propósito: en la app actual
   `workPath` es una copia de nombres tomada en el momento de crear la línea — si el plan de mantenimiento
   cambia después (o se borra un nivel), la línea ya creada no se ve afectada. Si se usara una FK real ahí,
   se perdería ese comportamiento (la línea histórica cambiaría o se rompería si el nodo se edita/borra).
   Es una decisión de diseño ya tomada en el código (`workPath: string[]`), no un descuido del esquema.
4. **Multiempresa / sucursales**: el modelo actual asume un solo taller. Si se necesita manejar varias
   sucursales, la forma más simple es agregar una tabla `sucursales` y una columna `sucursal_id` en
   `activos`, `ordenes_trabajo`, `repuestos` y `usuarios`.
5. **Índices recomendados**: además de las llaves primarias/foráneas, conviene indexar
   `ordenes_trabajo.estado`, `ordenes_trabajo.codigo`, `lineas_ot.estado`, `repuestos.codigo` y
   `notificaciones.leido` — son los filtros que más se usan en las tablas de la aplicación.
6. **Firmas**: `usuarios.firma_imagen`, `firmas_requisa.firma_imagen` e `historial_ot.firma_imagen` guardan hoy la
   imagen PNG como base64 (igual que las fotos). En una base de datos real conviene guardar el archivo en
   almacenamiento de objetos y dejar solo la referencia; la copia por documento (no un JOIN a `usuarios`) es
   intencional.
