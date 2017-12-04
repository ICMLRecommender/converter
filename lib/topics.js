const moment = require('moment-timezone');
moment.tz.setDefault('America/Los_Angeles');

// ----------------------------------------------------------------------------
// CONSTANTS


// ----------------------------------------------------------------------------
// FUNCTIONS

function generateTopics(topicsDb) {
    return loadOriginalTopics(topicsDb)
        .then(transformTopics)
        .then((topics) => {
            topics.sort((a, b) => {
                return parseInt(a.id) - parseInt(b.id);
            });

            return Promise.resolve(topics);
        });
}

function transformTopics(oldTopics) {
    let topics = [];
    
    for(let i = 0, n = oldTopics.length; i < n; ++i) {
        topics.push(transformTopic(oldTopics[i].doc));
    }

    return Promise.resolve(topics);
}

function transformTopic(oldCluster) {
    let newTopic = {};

    newTopic.id = oldCluster.topic_cluster_id;
    newTopic.title = oldCluster.label;
    if(oldCluster.terms) {
        newTopic.keywords = oldCluster.terms.map(term => {
            return term.term;
        });
    }
    else {
        newTopic.keywords = [];
    }

    return newTopic;
}

function loadOriginalTopics(topicsDb) {
    return topicsDb.allDocs({
        include_docs: true,
        attachments: true
    }).then((result) => {
        return Promise.resolve(result.rows);
    });
}

// ----------------------------------------------------------------------------
// EXPORTS

module.exports = {
    generateTopics: generateTopics,
};