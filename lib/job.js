/** @package

 job.js

 21/04/2015 NF   Removed database code. ie. From Job.remove()

 Last change: NF 21/04/2015 1:20:47 PM
 */

var humanInterval = require('human-interval'),
    CronTime = require('cron').CronTime,
    date = require('date.js'),
    moment = require('moment-timezone'),
    later = require('later');

var Job = module.exports = function Job(args) {
    args = args || {};

    // Remove special args
    this.agenda = args.agenda;
    delete args.agenda;

    // Process args
    args.priority = parsePriority(args.priority) || 0;

    // Set attrs to args
    var attrs = {};
    for (var key in args) {
        if (args.hasOwnProperty(key)) {
            attrs[key] = args[key];
        }
    }

    // Set defaults if undefined
    attrs.nextRunAt = attrs.nextRunAt || new Date();
    attrs.type = attrs.type || 'once';
    this.attrs = attrs;
};

Job.prototype.toJSON = function () { // create a persistable Mongo object -RR
    var self = this,
        attrs = self.attrs || {};

    var result = {};

    for (var prop in attrs) {
        if (attrs.hasOwnProperty(prop)) {
            result[prop] = attrs[prop];
        }
    }

    var dates = ['lastRunAt', 'lastFinishedAt', 'nextRunAt', 'failedAt', 'lockedAt'];
    dates.forEach(function (d) {
        if (result[d]) {
            result[d] = new Date(result[d]);
        }
    });

    return result;
};

Job.prototype.computeNextRunAt = function () {
    var interval = this.attrs.repeatInterval;
    var timezone = this.attrs.repeatTimezone;
    var repeatAt = this.attrs.repeatAt;
    this.attrs.nextRunAt = undefined;

    if (interval) {
        computeFromInterval.call(this);
    } else if (repeatAt) {
        computeFromRepeatAt.call(this);
    }
    return this;

    function dateForTimezone(d) {
        d = moment(d);
        if (timezone) d.tz(timezone);
        return d;
    }

    function computeFromInterval() {
        var lastRun = this.attrs.lastRunAt || new Date();
        lastRun = lastRun.setSeconds(0, 0);
        lastRun = dateForTimezone(lastRun);
        lastRun = new Date(lastRun);

        try {
            // var cronTime = new CronTime(interval);
            // var nextDate = cronTime._getNextDateFrom(lastRun);
            var nextDate = getNextDate(interval, lastRun);
            nextDate = dateForTimezone(nextDate);
            console.log("next date->>" + nextDate.format());
            this.attrs.nextRunAt = nextDate;
        } catch (e) {
            // Nope, humanInterval then!
            try {
                if (!this.attrs.lastRunAt && humanInterval(interval)) {
                    this.attrs.nextRunAt = lastRun.valueOf();
                } else {
                    this.attrs.nextRunAt = lastRun.valueOf() + humanInterval(interval);
                }
            } catch (e) {
            }
        } finally {
            if (isNaN(this.attrs.nextRunAt)) {
                this.attrs.nextRunAt = undefined;
                this.fail('failed to calculate nextRunAt due to invalid repeat interval');
            }
        }
    }

    //get the next execution date
    function getNextDate(pattern, date) {
        var patArr = pattern.split("||")[0];
        var type = pattern.split("||")[1];
        console.log("Last Run->>" + date.toLocaleString());

        if (type == "MIN") {
            return minPat(patArr, date);
        }

        if (type == "HOUR") {
            return hoursPat(patArr, date);
        }

        if (type == "DAYS") {
            return dayPat(patArr, date);
        }

        if (type == "WEEKS") {
            return weekPat(patArr, date);
        }

        if (type == "MONTHS") {
            return monthPat(patArr, date);
        }

        if (type == "YEARS") {
            return yearPat(patArr, date);
        }
    }

    //calculation for minimum pattern
    function minPat(patArr, current) {
        var recur_min = (patArr.split(" ")[0]).split("/")[1];
        console.log(recur_min);
        console.log(current.getMinutes());
        current.setMinutes(current.getMinutes() + parseInt(recur_min));
        return current;
    }

    //calculations for hours pattern
    function hoursPat(patArr, current) {
        var recur_hour = parseInt((patArr.split(" ")[1]).split("/")[1]);
        var minute = patArr.split(" ")[0];
        current.setHours(current.getHours() + recur_hour);
        current.setMinutes(minute);
        return current;
    }

    //calculations for date pattern
    function dayPat(patArr, current) {
        var minute = parseInt(patArr.split(" ")[0]);
        var hour = parseInt(patArr.split(" ")[1]);
        if (patArr.split(" ")[4] != "MON-FRI") {
            var recur_days = parseInt((patArr.split(" ")[2]).split("/")[1]);
            current.setDate(current.getDate() + recur_days);
            current.setHours(hour);
            current.setMinutes(minute);
            return current;
        } else {
            current.setDate(current.getDate() + 1);
            var dayByName = current.toString().split(" ")[0].toUpperCase();
            if (dayByName == "SAT") {
                current.setDate(current.getDate() + 2);
            }
            current.setHours(hour);
            current.setMinutes(minute);
            return current;
        }
    }

    //calculation for weeks pattern
    function weekPat(patArr, last) {
        var minute = parseInt(patArr.split(" ")[0]);
        var hour = parseInt(patArr.split(" ")[1]);
        last.setHours(hour);
        last.setMinutes(minute);

        var weekStr = (patArr.split(" ")[4]).split("$")[0];
        var days = weekStr.split(",");
        var recur_week = parseInt((patArr.split(" ")[4]).split("$")[1]);
        var current = new Date();
        current = current.setSeconds(0, 0);
        current = dateForTimezone(current);
        current = new Date(current);
        current.setHours(hour);
        current.setMinutes(minute);

        var numDays = days.map((d, index, array) => {
            return mapDaysToNumbers(d);
        });

        var diff = dateDiffInDays(current, last);
        if (diff == 0) {
            var stCurDate = current.toString().split(" ")[0].toUpperCase();
            var stCurDateNum = parseInt(mapDaysToNumbers(stCurDate));
            var fDate = null;

            for (var k = 0; k < numDays.length; k++) {
                if (stCurDateNum < numDays[k]) {
                    fDate = numDays[k];
                    break;
                }
            }
            if (fDate != null) {
                current.setDate(current.getDate() + (fDate - stCurDateNum));
            } else {
                current.setDate(current.getDate() + (7 * recur_week) - (stCurDateNum - numDays[0]));    //get the next recur week
            }
            return current;
        } else {
            var stLastDate = last.toString().split(" ")[0].toUpperCase();
            var stLastDateNum = parseInt(mapDaysToNumbers(stLastDate));
            if (0 < numDays.length) {
                last.setDate(last.getDate() - (stLastDateNum - 1));
                var v = last.toString().split(" ")[0].toUpperCase();
                var vnum = parseInt(mapDaysToNumbers(v));
                var diffn = parseInt(numDays[1] - vnum);
                last.setDate(last.getDate() + diffn);
            } else {
                last.setDate(last.getDate() + (7 * recur_week) - (stLastDateNum - numDays[0]));    //get the next recur week
            }
            return last; //next execution date
        }
    }

    //calculations for month patterns
    function monthPat(patArr, current) {
        var minute = parseInt(patArr.split(" ")[0]);
        var hour = parseInt(patArr.split(" ")[1]);
        var recur_month = parseInt((patArr.split(" ")[3]).split("/")[1]);

        current.setMinutes(minute);
        current.setHours(hour);

        if (!patArr.includes("#")) {
            var day = parseInt(patArr.split(" ")[2]);
            current.setDate(day);
            current.setMonth(current.getMonth() + recur_month);
            return current;
        } else {
            var dayOfWeek = parseInt((patArr.split(" ")[4]).split("#")[0]);
            var s = later.parse.cron(patArr);
            var k = later.schedule(s).next(1, current);
            var neDate = new Date(k);

            var actualM = recur_month + parseInt(current.getMonth());
            if (12 < actualM) {
                actualM = actualM - 12;
            }
            var diff = parseInt(actualM - parseInt(neDate.getMonth()));

            if (0 < diff) {
                neDate.setMonth(neDate.getMonth() + diff);
            } else {
                neDate.setMonth(neDate.getMonth() - diff); //this condition is not sure
            }

            var lDate = neDate.toString().split(" ")[0].toUpperCase();
            lDate = mapDaysToNumbers(lDate);
            var dd = (dayOfWeek - lDate);

            if (0 < dd) {
                neDate.setDate(neDate.getDate() + dd);
            } else {
                neDate.setDate(neDate.getDate() + dd);
            }

            if (parseInt(neDate.getMonth()) > actualM) {
                neDate.setDate(neDate.getDate() - 7);
            } else if (parseInt(neDate.getMonth()) < actualM) {
                neDate.setDate(neDate.getDate() + 7);
            }
            return neDate;
        }
    }

    function yearPat(patArr, current) {
        var minute = parseInt(patArr.split(" ")[0]);
        var hour = parseInt(patArr.split(" ")[1]);
        var month = patArr.split(" ")[3].toUpperCase();
        var monthNum = mapMonthsToNumbers(month);
        var recur_year = parseInt((patArr.split(" ")[5]).split("/")[1]);

        current.setMinutes(minute);
        current.setHours(hour);
        current.setMonth(parseInt(monthNum));

        if (!patArr.includes("#")) {
            var day = parseInt(patArr.split(" ")[2]);
            current.setDate(parseInt(day));
            current.setYear(current.getFullYear() + recur_year);
            return current;
        } else {
            var dayOfWeek = parseInt((patArr.split(" ")[4]).split("#")[0]);

            var s = later.parse.cron(patArr);
            var k = later.schedule(s).next(1, current);
            var neDate = new Date(k);
            var actualY = recur_year + parseInt(current.getFullYear());
            var diff = parseInt(actualY - parseInt(neDate.getFullYear()));

            if (0 < diff) {
                neDate.setYear(neDate.getFullYear() + diff);
            } else {
                neDate.setYear(neDate.getFullYear() - diff);    //not sure about this condition
            }

            var lDate = neDate.toString().split(" ")[0].toUpperCase();
            lDate = mapDaysToNumbers(lDate);
            var dd = (dayOfWeek - lDate);

            if (0 < dd) {
                neDate.setDate(neDate.getDate() + dd);
            } else {
                neDate.setDate(neDate.getDate() + dd);
            }

            if (parseInt(neDate.getMonth()) > parseInt(monthNum)) {
                neDate.setDate(neDate.getDate() - 7);
            } else if (parseInt(neDate.getMonth()) < parseInt(monthNum)) {
                neDate.setDate(neDate.getDate() + 7);
            }
            return neDate;
        }
    }


// a and b are javascript Date objects
    function dateDiffInDays(a, b) {
        var _MS_PER_DAY = 1000 * 60 * 60 * 24;
        // Discard the time and time-zone information.
        var utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
        var utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

        return Math.floor((utc2 - utc1) / _MS_PER_DAY);
    }

    function mapDaysToNumbers(day) {
        switch (day) {
            case "SUN":
                return 1;

            case "MON":
                return 2;

            case "TUE":
                return 3;

            case "WED":
                return 4;

            case "THU":
                return 5;

            case "FRI":
                return 6;

            case "SAT":
                return 7;
        }
    }

    function mapMonthsToNumbers(month) {
        switch (month) {
            case "JAN":
                return 0;
            case "FEB":
                return 1;
            case "MAR":
                return 2;
            case "APR":
                return 3;
            case "MAY":
                return 4;
            case "JUN":
                return 5;
            case "JULY":
                return 6;
            case "AUG":
                return 7;
            case "SEP":
                return 8;
            case "OCT":
                return 9;
            case "NOV":
                return 10;
            case "DEC":
                return 11;
        }
    }

    function computeFromRepeatAt() {
        var lastRun = this.attrs.lastRunAt || new Date();
        var nextDate = date(repeatAt).valueOf();

        var offset = Date.now();  // if you do not specify offset date for below test it will fail for ms
        if (offset === date(repeatAt, offset).valueOf()) {
            this.attrs.nextRunAt = undefined;
            this.fail('failed to calculate repeatAt time due to invalid format');
        } else if (nextDate.valueOf() == lastRun.valueOf()) {
            this.attrs.nextRunAt = date('tomorrow at ', repeatAt);
        } else {
            this.attrs.nextRunAt = date(repeatAt);
        }
    }
};

Job.prototype.repeatEvery = function (interval, options) {
    options = options || {};
    this.attrs.repeatInterval = interval;
    this.attrs.repeatTimezone = options.timezone ? options.timezone : null;
    return this;
};

Job.prototype.repeatAt = function (time) {
    this.attrs.repeatAt = time;
    return this;
};

Job.prototype.disable = function () {
    this.attrs.disabled = true;
    return this;
};

Job.prototype.enable = function () {
    this.attrs.disabled = false;
    return this;
};

Job.prototype.unique = function (unique, opts) {
    this.attrs.unique = unique;
    this.attrs.uniqueOpts = opts;
    return this;
};

Job.prototype.schedule = function (time) {
    this._scheduled = true;
    this.attrs.nextRunAt = (time instanceof Date) ? time : date(time);
    return this;
};

Job.prototype.priority = function (priority) {
    this.attrs.priority = parsePriority(priority);
    return this;
};

Job.prototype.fail = function (reason) {
    if (reason instanceof Error) {
        reason = reason.message;
    }
    this.attrs.failReason = reason;
    this.attrs.failCount = (this.attrs.failCount || 0) + 1;
    this.attrs.failedAt = new Date();
    return this;
};

Job.prototype.run = function (cb) {
    var self = this,
        agenda = self.agenda,
        definition = agenda._definitions[self.attrs.name];

    var setImmediate = setImmediate || process.nextTick;
    setImmediate(function () {
        self.attrs.lastRunAt = new Date();
        self.computeNextRunAt();
        self.save(function () {
            var jobCallback = function (err) {
                if (err) {
                    self.fail(err);
                }

                self.attrs.lastFinishedAt = new Date();
                self.attrs.lockedAt = null;
                self.save(function (saveErr, job) {
                    cb && cb(err || saveErr, job);
                    if (err) {
                        agenda.emit('fail', err, self);
                        agenda.emit('fail:' + self.attrs.name, err, self);
                    } else {
                        agenda.emit('success', self);
                        agenda.emit('success:' + self.attrs.name, self);
                    }
                    agenda.emit('complete', self);
                    agenda.emit('complete:' + self.attrs.name, self);
                });
            };

            try {
                agenda.emit('start', self);
                agenda.emit('start:' + self.attrs.name, self);
                if (!definition) {
                    throw new Error('Undefined job');
                }
                if (definition.fn.length === 2) {
                    definition.fn(self, jobCallback);
                } else {
                    definition.fn(self);
                    jobCallback();
                }
            } catch (e) {
                jobCallback(e);
            }
        });
    });
};

Job.prototype.isRunning = function () {
    if (!this.attrs.lastRunAt) return false;
    if (!this.attrs.lastFinishedAt) return true;
    if (this.attrs.lockedAt && this.attrs.lastRunAt.getTime() > this.attrs.lastFinishedAt.getTime()) {
        return true;
    }
    return false;
};

Job.prototype.save = function (cb) {
    this.agenda.saveJob(this, cb);
    return this;
};

Job.prototype.remove = function (cb) {
    // refactored NF 21/04/2015
    this.agenda.cancel({_id: this.attrs._id}, cb);
    /*
     var self = this;
     this.agenda._db.remove({_id: this.attrs._id}, function(err, count) {
     if(err) {
     return cb(err);
     }
     cb(err, count);
     });
     */
};

Job.prototype.touch = function (cb) {
    this.attrs.lockedAt = new Date();
    this.save(cb);
};

function parsePriority(priority) {
    var priorityMap = {
        lowest: -20,
        low: -10,
        normal: 0,
        high: 10,
        highest: 20
    };
    if (typeof priority === 'number' || priority instanceof Number)
        return priority;
    else
        return priorityMap[priority];
}
