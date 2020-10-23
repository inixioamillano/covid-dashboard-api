// (c) 2020 Inixio Amillano Casteig
// Este código es de licencia GPL v3 (véase el fichero LICENSE para más detalles)

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const DatoDiario = require('./model/DatoDiario');
const ZonaSanitaria = require('./model/ZonaSanitaria');
const fs = require('fs');
const multer = require('multer');

// Configurar variables de entorno. Configuralas en el fichero .env. Puedes encontrar la estructura del fichero en .env.template
require('dotenv').config();
    
// Configuración de la subida del fichero csv
var storage = multer.diskStorage(
    {
        destination: './csv/',
        filename: function ( req, file, cb ) {
            cb( null, "datos.csv");
        },
        encoding: (req, res, cb) => {
            cb(null, 'utf-8')
        }
    }
);
const upload = multer({ storage });

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.listen(port, () => {
    console.log(`Servidor en ejecución: ${port}`);
});

const uri = process.env.DB_URL || 'mongodb://localhost:27017/covid-data';
mongoose.connect(uri, { useNewUrlParser: true, useCreateIndex: true });
const connection = mongoose.connection;
connection.once('open', async () => {
  console.log("Conectado a la base de datos");
})

// Devuelve todos los datos diarios
// Deprecated desde que se añadió más de una zona sanitaria
app.get('/datosdiarios', async (req, res) => {
    const datosDiarios = await DatoDiario.find({}).sort({fecha: 1});
    res.json(datosDiarios);
})

// Función que, a partir de un número de días (X) y un array de datos diarios te devuelve el número de contagios en los últimos X días
const ultimosXDias = (diasAnteriores, x) => {
    const ultimosDias = diasAnteriores.slice(-x);
    let resultado = 0;
    ultimosDias.map(dia => resultado = resultado + dia.infectadosHoy)
    return resultado;  
}

// A partir de una fecha, un número de infectados, y un codigo de zona, añade un nuevo dato diario en la zona de salud
app.post('/datodiario', async (req, res) => {
    const {acumuladosHoy, fecha, auth, idzona} = req.body;
    if (auth !== process.env.AUTH){
        return res.status(400).json({err: "No tienes acceso"});
    }
    try{
        const zona = await ZonaSanitaria.findOne({code: idzona});
        const diasAnteriores = await DatoDiario.find({_id: {"$in": zona.datosDiarios}}).sort({fecha: 1})
        const infectadosHoy = diasAnteriores.length > 0 ? acumuladosHoy - diasAnteriores[diasAnteriores.length-1].acumulados : acumuladosHoy;
        const ultimos7Dias = ultimosXDias(diasAnteriores, 6) + infectadosHoy;
        const ultimos14Dias = ultimosXDias(diasAnteriores, 13) + infectadosHoy;
        const ia7 = ultimos7Dias*100000/zona.habitantes;
        const ia14 = ultimos14Dias*100000/zona.habitantes;
        const acumulados = diasAnteriores.length > 0 ? diasAnteriores[diasAnteriores.length-1].acumulados + infectadosHoy : infectadosHoy;
        const dato = new DatoDiario({infectadosHoy, acumulados, ia7, ia14, fecha});
        await dato.save();
        zona.datosDiarios.push(dato);
        await zona.save();
        res.json(dato)
    } catch(e) {
        res.json({err: e})
    }
})

// Añade una nueva zona a la base de datos y calcula el histórico de datos a partir del fichero csv/datos.csv
/*
    IMPORTANTE: este código depende de la estructura del CSV que aporte los datos. El código original 
    sirve para el CSV proporcionado por el Gobierno de Navarra. Deberás modificar este código para acceder
    correctamente a los campos ofrecidos por tu comunidad/zona de salud
*/
app.post('/zonasanitaria', async (req, res) => {
    const {nombre, code, habitantes, auth} = req.body;
    if (auth !== process.env.AUTH){
        return res.status(400).json({err: "No tienes acceso"});
    }
    try {
        const csv = require('csvtojson')
        csv({
            delimiter: ";"
        })
        .setDefaultEncoding("utf8")
        .fromFile('./csv/datos.csv')
        .setEncoding("utf8")
        .then(async (datos)=>{
            let datosDiarios = [];
            datos.filter(d => d["Zona Básica"] === nombre).map(d => {
                const campos = d.Fecha.split(" ")[0].split("/")
                const fecha = campos[2]+"-"+campos[1]+"-"+campos[0]+" 00:00:00"
                const acumuladosAyer = datosDiarios[datosDiarios.length - 1] ? datosDiarios[datosDiarios.length - 1].acumulados : 0;
                const acumulados = Math.max(d["Casos acumulados"], acumuladosAyer); //Para ajustar posibles errores
                const infectadosHoy = datosDiarios.length > 0 ? acumulados - datosDiarios[datosDiarios.length-1].acumulados : acumulados;
                const ultimos7Dias = ultimosXDias(datosDiarios, 6) + infectadosHoy;
                const ultimos14Dias = ultimosXDias(datosDiarios, 13) + infectadosHoy;
                const ia7 = ultimos7Dias*100000/habitantes;
                const ia14 = ultimos14Dias*100000/habitantes;
                const dato = new DatoDiario({infectadosHoy, acumulados, ia7, ia14, fecha});
                datosDiarios.push(dato);
            })    
            await DatoDiario.insertMany(datosDiarios)
            const zona = new ZonaSanitaria({nombre, code, habitantes, datosDiarios});
            await zona.save();
            res.json(zona);
        })
    } catch (e) {
        return res.status(500).json({err: "Ha ocurrido un error. Por favor, inténtalo de nuevo más tarde", e});
    }
})

// A partir del código de una zona de salud devuelve los datos diarios en orden cronológico
app.get('/datosporzona', async (req, res) => {
    const {code} = req.query;
    if (!code) {
        return res.status(500).json({err: "Por favor, especifica la zona de salud"})
    }
    try{
        const zona = await ZonaSanitaria.findOne({code})
        const datosDiarios =  await DatoDiario.find({_id: {"$in": zona.datosDiarios}}).sort({fecha: 1});
        res.json(datosDiarios);
    } catch(e) {
        return res.status(404).json({err: "La zona sanitaria que has especificado no existe"})
    }
})

// Devuelve las zonas básicas de salud en orden alfabético
app.get('/zonas', async (req, res) => {
    const zonas = await ZonaSanitaria.find({}).select({nombre: 1, code: 1, habitantes: 1}).sort({nombre: 1});
    res.json(zonas);
})

// Actualiza manualmente el fichero csv
app.post('/actualizarfichero', upload.single("file"), (req, res) => {
    var buffer = fs.readFileSync('./csv/datos.csv', {encoding: 'binary'});
    var iconv = require('iconv-lite');
    var output = iconv.decode(buffer, "ISO-8859-1");
    fs.writeFileSync('./csv/datos.csv', output);
    res.json({status: "OK"})
})

// Actualización automática de los datos comprobando la existencia de nuevos datos cada 30 segundos
/**
 * IMPORTANTE: una vez más, deberás modificar este código para que se ajuste a la estructura del fichero CSV descargado
 */
setInterval(async () => {
    var axios = require("axios")
    var config = {
        method: 'get',
        url: process.env.CSV_SOURCE,
        headers: { }
    };
    
    axios(config)
    .then(function (response) {
        var iconv = require('iconv-lite');
        var output = iconv.decode(response.data, "ISO-8859-1");
        fs.writeFileSync('./csv/datos_descargados.csv', output);    

        const csv = require('csvtojson')
        csv({
            delimiter: ";"
        })
        .fromFile('./csv/datos_descargados.csv')
        .then(async (datos)=>{
            const columnas = Object.keys(datos[0])
            const ultimoDatoCSV = datos[datos.length-1];
            const fecha = ultimoDatoCSV["Fecha"];
            const campos = fecha.split(" ")[0].split("/")
            const fechaEnBD = campos[2]+"-"+campos[1]+"-"+campos[0]+" 00:00:00";
            const posterioresAFecha = await DatoDiario.find({fecha: {"$eq": fechaEnBD}});
            if (posterioresAFecha.length > 0) {
                return;
            }
            console.log("Datos nuevos disponibles")
            const zonas = await ZonaSanitaria.find({});
            zonas.map(async zona => {
                const datoHoy = await DatoDiario.find({_id: {"$in": zona.datosDiarios}, fecha: fechaEnBD});
                if (datoHoy.length === 0) {
                    //Aun no hay dato para esta fecha en este dia
                    const dato = datos.find(d => d[columnas[1]] === fecha && d[columnas[4]] === zona.nombre);
                    if (dato) {
                        const acumulados = dato[columnas[5]];
                        const diasAnteriores = await DatoDiario.find({_id: {"$in": zona.datosDiarios}});
                        const infectadosHoy = diasAnteriores.length > 0 ? acumulados - diasAnteriores[diasAnteriores.length - 1].acumulados : acumulados;
                        const ultimos7Dias = ultimosXDias(diasAnteriores, 6) + infectadosHoy;
                        const ultimos14Dias = ultimosXDias(diasAnteriores, 13) + infectadosHoy;
                        const ia7 = ultimos7Dias*100000/zona.habitantes;
                        const ia14 = ultimos14Dias*100000/zona.habitantes;
                        try{
                            const datoNuevo = new DatoDiario({infectadosHoy, acumulados, ia7, ia14, fecha: fechaEnBD});
                            await datoNuevo.save();
                            zona.datosDiarios.push(datoNuevo);
                            await zona.save();
                        } catch (e) {
                            console.log(e)
                        }        
                    } 
                }
            }) 
        })
        .catch(e => console.log(e))

    })
    .catch(function (error) {
        console.log(error);
    });
}, 30*1000)

// Añade los datos de una fecha concreta a partir del fichero csv/datos.csv
/**
 * Deprecated desde que se añadió la actualización automática de datos
 */
app.post('/datosporfecha', async (req, res) => {
    const {auth, fecha} = req.body;
    //Formato de fecha dd/mm/yyyy 0:00
    if (auth !== process.env.AUTH){
        return res.status(400).json({err: "No tienes acceso"});
    }

    const csv = require('csvtojson')
    csv({
        delimiter: ";"
    })
    .fromFile('./csv/datos.csv')
    .then(async (datos)=>{
        const zonas = await ZonaSanitaria.find({});
        zonas.map(async zona => {
            const campos = fecha.split(" ")[0].split("/")
            const fechaEnBD = campos[2]+"-"+campos[1]+"-"+campos[0]+" 00:00:00";
            const datoHoy = await DatoDiario.find({_id: {"$in": zona.datosDiarios}, fecha: fechaEnBD});
            if (datoHoy.length === 0) {
                //Aun no hay dato para esta fecha en este dia
                const dato = datos.find(d => d["Fecha"] === fecha && d["Zona Básica"] === zona.nombre);
                if (dato) {
                    const acumulados = dato["Casos acumulados"];
                    const diasAnteriores = await DatoDiario.find({_id: {"$in": zona.datosDiarios}});
                    const infectadosHoy = diasAnteriores.length > 0 ? acumulados - diasAnteriores[diasAnteriores.length - 1].acumulados : acumulados;
                    const ultimos7Dias = ultimosXDias(diasAnteriores, 6) + infectadosHoy;
                    const ultimos14Dias = ultimosXDias(diasAnteriores, 13) + infectadosHoy;
                    const ia7 = ultimos7Dias*100000/zona.habitantes;
                    const ia14 = ultimos14Dias*100000/zona.habitantes;
                    const datoNuevo = new DatoDiario({infectadosHoy, acumulados, ia7, ia14, fecha: fechaEnBD});
                    await datoNuevo.save();
                    zona.datosDiarios.push(datoNuevo);
                    await zona.save();        
                } 
            }
        }) 
        res.json({status: "OK"})
    })
})

