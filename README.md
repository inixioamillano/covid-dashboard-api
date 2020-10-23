# Covid Dashboard | API REST

API REST de acceso a datos de evolución del Covid por zona básica de salud

## Requisitos

Para el desarrollo sólo necesitarás Node.js y NPM (Node Package Manager, el gestor de paquetes de Node).

## Descripción del proyecto

Este API REST ofrece acceso y almacenaje de datos diarios sobre la evolución del Covid en distintas zonas sanitarias

## Demo

Puedes encontrar el proyecto funcionando en [Datos Covid | Navarra](https://covidnavarra.herokuapp.com)

## Lanzar el proyecto
Para lanzar el proyecto ejecuta `node index.js`. Antes de la primera ejecución debes ejecutar `npm install` para instalar todos los paquetes necesarios

## Variables de entorno

Las variables a configurar en el fichero .env son las siguientes:

* PORT: puerto en el que escuchará el servidor

* DB_URL: URL de la base datos en la que se almacenarán los datos 
`mongodb://[host]:[puerto]/[nombre de la coleccion]`

* AUTH: Contarseña para proteger las rutas delicadas

* CSV_SOURCE: URL desde la que se obtiene el CSV con los datos

## Autor

Puedes saber más sobre mí en mi [LinkedIn](https://www.linkedin.com/in/inixio-amillano-casteig/) y en mi [página web](https://inixio.dev)

## Licencia

[GNU - General Public License](https://www.gnu.org/licenses/gpl-3.0.html)
