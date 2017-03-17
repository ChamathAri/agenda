var agenda = module.exports = require('./lib/agenda.js');

//var Agenda = require('./lib/agenda.js');

// var mongoConnectionString = "mongodb://wf:wf@ds119370.mlab.com:19370/jobs";
// var agenda = new Agenda({
//     db: {address: mongoConnectionString, collection: "agendaJobs"},
//     processEvery:"50 seconds",
//     maxConcurrency: 20,
//     defaultConcurrency: 5
// });
//
//
// agenda.on('ready', function () {
//     agenda.define('delete old users', function (job, done) {
//         console.log("its executing");
//     });
// });
//
//
// agenda.on('ready', function () {
//     agenda.every('0/1 * 1/1 * ? *', 'delete old users', 'datta', {timezone: 'Asia/Colombo'});
//     agenda.start();
// });