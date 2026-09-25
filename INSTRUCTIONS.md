





Ayúdame a implementar estos cambios en el proyecto, pero antes de aplicarlos muestre previamente los cambios que estas pensando realizar.



###### Activos:

\-Ocultar el botón de "Crear ficha local" -> esta funcionalidad la implementaré luego

\-Agregar botón de "Sincronizar", esto es para sincronizar la información del activo/vehiculo de SAP con el sistema.

\-

###### Repuestos / Inventario:

\- Quitar el botón de "Registrar movimiento" y su funcionalidad.



###### Ordenes de Trabajo:

\-Necesito agregar la vista de "Cuadricula" o de "Lista" en los registros de los activos, y que "Lista" sea la selección predeterminada.

\-Agregar más información en la OT cuando se visualiza en grid ó las cards.

\-Necesito quitar la opción que ya existe de draggable

\-Al crear la OT el campo de origen debe ser realmente tipo de trabajo (correctivo, preventivo, inspección, emergencia).

\-El campo de "modalidad" quiero que lo quites.

\-Quiero que al presionar la card de OT, dentro de la OT debe haber las opciones para "Agregar actividad", actualmente esta "Agregar Linea(Hallazgo)", sustituyelo. ese botón debería de abrir un modal donde se muestre el formulario de las lineas de trabajo que realizará.

\------------------------------------------

Modifica únicamente la sección de \*\*Líneas de Trabajo\*\* dentro de la Orden de Trabajo. No cambies el layout general, navegación, estilos ni otros módulos existentes.



Quiero que una OT pueda contener múltiples líneas de trabajo independientes. Cada línea debe funcionar como una unidad de ejecución y trazabilidad.



Ejemplo:



\* Cambio de llanta — Trasera derecha — Completado

\* Cambio de foco — Frontal derecho — Completado

\* Reparación de cableado — Sistema eléctrico — Requiere seguimiento



\### Cada línea debe incluir:



\* Trabajo

\* Ubicación

\* Clasificación

\* Estado

\* Técnico responsable

\* Fecha/hora de inicio y finalización

\* Tiempo trabajado

\* Evidencias fotográficas

\* Repuestos utilizados

\* Observaciones



\### Evidencias



Separar fotografías en dos grupos:



\*\*Antes\*\*

\[📷] \[📷] \[+]



\*\*Después\*\*

\[📷] \[📷] \[+]



Permitir múltiples imágenes, visualizar miniaturas, ampliar y eliminar fotografías.



\### Diseño



Mostrar las líneas como \*\*tarjetas/acordeones expandibles\*\*, no todas abiertas simultáneamente.



Vista contraída:



`01 · Cambio de llanta · Trasera derecha     ● Completado`



Al expandir, mostrar la información de ejecución, evidencias, repuestos y observaciones.



Agregar un botón:



\*\*+ Agregar línea de trabajo\*\*



El formulario de creación debe solicitar Trabajo, Ubicación, Clasificación, Técnico, Estado y Observaciones. Las evidencias y repuestos podrán agregarse durante la ejecución.



Los estados deben ser:



\* Pendiente

\* En ejecución

\* Esperando repuesto

\* Completado

\* Completado con observaciones

\* No completado

\* Requiere seguimiento



Mantén el estilo actual de la aplicación: \*\*dashboard corporativo, limpio, profesional y denso\*\*, reutilizando los componentes existentes.



No elimines funcionalidades existentes ni modifiques otras partes de la aplicación.

Implementa un flujo simple de estados para las \*\*Órdenes de Trabajo (OT)\*\*:



\*\*Crear OT → Pendiente de aprobación → Aprobada → En ejecución → Finalizada → Cerrada\*\*



Asigna los roles de la siguiente manera:



\* \*\*Solicitante:\*\* crea la OT y puede consultar su estado.

\* \*\*Supervisor/Administrador:\*\* revisa y aprueba la OT.

\* \*\*Técnico de taller:\*\* ejecuta los trabajos, registra avances, evidencias, repuestos y finaliza la OT.

\* \*\*Supervisor/Administrador:\*\* revisa el trabajo finalizado y realiza el cierre de la OT.



La interfaz debe mostrar visualmente el progreso de la OT mediante una \*\*línea de tiempo (timeline)\*\* con cada etapa, indicando el estado actual y el rol responsable.



Mantén el diseño y estilos actuales de la aplicación. No modifiques otros módulos.


\------------------------------------------



