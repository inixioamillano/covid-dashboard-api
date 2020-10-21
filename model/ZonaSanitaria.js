const mongoose = require('mongoose');
const mongooseDateFormat = require('mongoose-date-format');

const Schema = mongoose.Schema;

const zonaSanitariaSchema = new Schema({
  nombre: { //Nombre de la zona sanitaria
    type: String,
    required: true
  },
  code: { //Código identificador
    type: String,
    required: true
  },
  habitantes: { //Número de habitantes en la zona sanitaria
    type: Number,
    required: true,
    min: 0
  },
  datosDiarios: [{ //Lista de datos diarios (Referencia a DatoDiario)
    type: Schema.ObjectId, 
    ref: 'DatoDiario' }]
}, {
  timestamps: true,
});

zonaSanitariaSchema.plugin(mongooseDateFormat);
const ZonaSanitaria = mongoose.model('ZonaSanitaria', zonaSanitariaSchema);

module.exports = ZonaSanitaria;