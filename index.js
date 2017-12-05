/**
 * This file is intended to convert adrien's original data
 * to differently structured data for use by the front.
 */

const config = require('config');
const PouchDB = require('pouchdb');
const moment = require('moment-timezone');
moment.tz.setDefault('America/Los_Angeles');

// ----------------------------------------------------------------------------
// CONSTANTS

// ---  Databases
const sessionsDb = new PouchDB(config.serverBaseUrl + config.collections.originalSchedule);
const itemsDb = new PouchDB(config.serverBaseUrl + config.collections.papers);
const authorsDb = new PouchDB(config.serverBaseUrl + config.collections.authors);
const topicClustersDb = new PouchDB(config.serverBaseUrl + config.collections.topics);
const scheduleDb = new PouchDB(config.serverBaseUrl + config.collections.newSchedule);


let SESS = require('./lib/sessions');
let ITEMS = require('./lib/items');
let PEOPLE = require('./lib/people');
let TOPICS = require('./lib/topics');

// ----------------------------------------------------------------------------
// MAIN

SESS.loadOriginalSchedule(sessionsDb)
    .then(SESS.enrichSessions)
    .then((sessions) => {
        sessions.sort(SESS.sessionSorter);

        // for(let i = 0, n = sessions.length; i < n; ++i) {
        //     let s = sessions[i];
        //     console.log(s.session_time + ' : \t' + s.type_code + '\t' + s.session);
        // }

        return Promise.resolve(sessions);
    })
    .then(SESS.splitSessionsByDays)
    .then(SESS.groupSessionsByStart)
    .then(SESS.simplifySchedule)
    .then(SESS.groupSchedule)
    .then((sessions) => {
        return allObject({
            dailySchedule: SESS.populateDaylyShedule(sessions),
            sessionIdToIndexMapping: SESS.populateSessionMapping(sessions),
            items: ITEMS.generateItems(itemsDb),
            people: PEOPLE.generatePeople(authorsDb)
        })
        .then((results) => {
            addContentIndex(sessions, results.items);
            addInvitedTalksAsPapers(sessions, results.items, results.people);
    
            results.sessions = sessions;
            results._id = 'schedule_nips17';

            console.log('Schedule written in schedule_nips17.');
            return replaceDoc(scheduleDb, results);
        });
    })
    .catch(function (err) {
        console.log('ERROR: ', err);
    });

TOPICS.generateTopics(topicClustersDb)
    .then(topics => {
        console.log('Topics written in topics_nips17.');

        let doc = {
            _id: 'topics_nips17',
            topics: topics
        };
        return replaceDoc(scheduleDb, doc);
    })
    .catch(function (err) {
        console.log('ERROR: ', err);
    });

// ----------------------------------------------------------------------------
// FUNCTIONS

function allObject(obj, mapFunction) {
	var keys = Object.keys(obj);
	var promises = [];

	keys.forEach(key => {
		promises.push(obj[key]);
	});

	return Promise.all(promises)
		.then(results => {
			if(mapFunction) {
				return mapFunction(results);
			}
			else {
				return Promise.resolve(results);
			}
		})
		.then(results => {
			var result = {};
			var i = 0;
			keys.forEach(key => {
				result[key] = results[i++];
			});
			return Promise.resolve(result);
		});
}

function replaceDoc(db, doc) {
    return db.get(doc._id)
        .then(initialDoc => {
            if(initialDoc) {
                doc._rev = initialDoc._rev;
            }

            return db.put(doc);
        });
}

function addContentIndex(sessions, items) {
    for(var dayIndex = 0; dayIndex < sessions.length; ++dayIndex) {
        let timeslots = sessions[dayIndex];
        for (var timeslotIndex = 0; timeslotIndex < timeslots.length; ++timeslotIndex) {
            let subtimeslots = timeslots[timeslotIndex];
            for (var subtimeslotIndex = 0; subtimeslotIndex < subtimeslots.length; ++subtimeslotIndex) {
                let sessionsInThisSubTimeSlot = subtimeslots[subtimeslotIndex];
                for(var h = 0; h < sessionsInThisSubTimeSlot.length; ++h) {
                    let t_session = sessionsInThisSubTimeSlot[h];
                    let t_session_id = t_session.session_id;
                    if(t_session.type_code=="poster" || t_session.type_code=="oral" || t_session.type_code=="spotlight") {
                        let s_content = t_session.content;
                        if(s_content == undefined) {
                            console.log(t_session.session);
                        }
                        else {
                            for(var ci = 0; ci < s_content.length; ++ci) {
                                let content_item = s_content[ci];
                                let paper_id = content_item.paper_id;
                                let paper = items[paper_id];
                                if(paper) {
                                    if(items[paper_id][t_session.type_code + "_session"] == undefined) {
                                        items[paper_id][t_session.type_code + "_session"] = {};
                                    }
                                    items[paper_id][t_session.type_code + "_session"].content_index = ci;
                                }
                                else {
                                    console.log('------------------------ paper not found: ');
                                    console.dir(t_session);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

function addInvitedTalksAsPapers(sessions, items, people) {
    let invitedTalksAdded = 0;
    let invitedTalksIdStart = 8000;

    for(var dayIndex = 0; dayIndex < sessions.length; ++dayIndex) {
        timeslots = sessions[dayIndex];
        for (var timeslotIndex = 0; timeslotIndex < timeslots.length; ++timeslotIndex) {
            subtimeslots = timeslots[timeslotIndex];
            for (var subtimeslotIndex = 0; subtimeslotIndex < subtimeslots.length; ++subtimeslotIndex) {
                sessionsInThisSubTimeSlot = subtimeslots[subtimeslotIndex];
                for(var h = 0; h < sessionsInThisSubTimeSlot.length; ++h) {
                    t_session = sessionsInThisSubTimeSlot[h];
                    t_session_id = t_session.session_id;
                    
                    if((t_session.type_code == "invited_talk") && t_session.content && (t_session.content.length > 0)) {
                        //console.log(t_session);
                        let s_content = t_session.content[0];
                        
                        newItem = {};
                        newItem.id = invitedTalksIdStart + invitedTalksAdded++;
                        t_session.paper_id = newItem.id;

                        newItem.title = s_content.title;
                        newItem.description = s_content.abstract;
                        if(s_content.authors == {}) {
                            newItem.authors = [];
                            newItem.authorIds = [];
                            newItem.authorsString = "";
                        }
                        else {
                            newItem.authors = s_content.authors;
                            newItem.authorIds = [s_content.authors[0].author_id];
                            newItem.authorsString = s_content.authors[0].author;
                        }

                        newItem.oral_session = {
                            type: "Invited Talk",
                            session_id: t_session.session_id,
                            time_start: t_session.session_time_start,
                            time_end: t_session.session_time_end
                        };

                        items[newItem.id] = newItem;

                        // --- link to author
                        let author = people[s_content.authors[0].author_id];
                        if(typeof author.paper_ids != 'array') {
                            author.paper_ids = [];
                        }
                        author.paper_ids.push('' + newItem.id);
                    }
                }
            }
        }
    }
}
