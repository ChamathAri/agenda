var agenda = module.exports = require('./lib/agenda.js');

//var Agenda = require('./lib/agenda.js');

// var mongoConnectionString = "mongodb://wf:wf@ds119370.mlab.com:19370/jobs";
// var agenda = new Agenda({
//     db: {address: mongoConnectionString, collection: "agendaJobs"},
//     processEvery: "50 seconds",
//     maxConcurrency: 20,
//     defaultConcurrency: 5
// });
//
// var message = "Avenger's assemble!!!";
//
//
// agenda.on('ready', function () {
//     agenda.define(message, function (job) {
//         new Promise((resolve, reject) => {
//             console.log("Triggered -> -> :: " + job.attrs.name);
//         }).catch((err) => {
//             console.log("There was an error in the execution of the job" + err.stack);
//         });
//     });
// });
//
//
// agenda.on('ready', function () {
//     agenda.every('0/1 * 1/1 * ? *', message, "Avenger's Data", {timezone: 'Asia/Colombo'});
//     agenda.start();
// });