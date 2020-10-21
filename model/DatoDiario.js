const mongoose = require('mongoose');
const mongooseDateFormat = require('mongoose-date-format');

const Schema = mongoose.Schema;

const datoDiarioSchema = new Schema({
  infectadosHoy: { //Número de infectados para esta fecha
    type: Number,
    required: true,
    min: 0
  },
  acumulados: { //Total acumulados para una fecha
    type: Number,
    required: true,
    min: 0
  },
  ia7: { //Incidencia acumulada en los últimos 7 días por cada 100.000 habitantes
    type: Number,
    required: true,
    min: 0
  },
  ia14: { //Incidencia acumulada en los últimos 14 días por cada 100.000 habitantes
    type: Number,
    required: true,
    min: 0
  },
  fecha: { //Fecha del dato
    type: Date,
    required: true,
    default: new Date()
  }

}, {
  timestamps: true,
});

datoDiarioSchema.plugin(mongooseDateFormat);
const DatoDiario = mongoose.model('DatoDiario', datoDiarioSchema);

module.exports = DatoDiario;