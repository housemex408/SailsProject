/**
 * Created by jalvarado on 3/12/14.
 */
// ReleaseNotes.js - in api/services
var Client = require('node-rest-client').Client;
var auth = {user: "jalvarado", password: "Mam80samba"};
var client = new Client(auth);
client.registerMethod("notes", "http://jira/rest/api/2/search", "GET");
client.registerMethod("projects", "http://jira/rest/api/2/project", "GET");
client.registerMethod("versions", "http://jira/rest/api/2/project/${project}/versions", "GET");

var LogLibrary = require('./Logger');

exports.getProjects = function (res) {
    var logger = LogLibrary.get();
    logger.info("entering ReleaseNotes.getProjects()");

    var args = {};

    client.methods.projects(args, function (data) {
        var projects = JSON.parse(data);
        var results = [];

        projects.forEach(function (project) {
            results.push({
                key: project.key,
                name: project.name
            });
        });

        logger.debug(projects);

        return res.view({
            projects: results
        })
    });
};

exports.getVersions = function (res, project) {
    var args = {
        path: {'project': project}
    };

    client.methods.versions(args, function (data) {
        var versions = JSON.parse(data);
        var results = [];

        versions.forEach(function (version) {
            if (version.released == true) {
                results.push({
                    releaseDate: version.releaseDate,
                    name: version.name,
                    description: version.description
                });
            }
        });

        return res.view({
            versions: results,
            project: project
        })
    });
};


exports.getNotes = function (res, project, version) {
    var logger = LogLibrary.get();

    var args = {
        parameters: {
            jql: "fixVersion='" + version + "' AND project='" + project + "' ORDER BY Key",
            fields: "issuetype,summary"
        }
    };

    client.methods.notes(args, function (data) {
        var issues = JSON.parse(data).issues;
        logger.info("entering ReleaseNotes.getNotes()");
        logger.debug(issues);

        // To find by a criteria
        Release.findOne({
            project: project,
            version: version
        }).done(function (err, release) {
                var notes;
                if (err) {
                    logger.info("content not found");

                } else {
                    if (release != null || release != undefined) {
                        logger.info("content found: ", release);
                        notes = release.content;
                    }
                }

                return res.view({
                    issues: issues,
                    version: version,
                    project: project,
                    content: notes
                })
            });
    });
};


exports.update = function (res, project, version, content, contentid, pageId) {
    var logger = LogLibrary.get();

    var create = function () {
        Release.create({
            content: content,
            project: project,
            version: version,
            contentid: contentid,
            pageid: pageId
        }).done(function (err, release) {
                if (err) {
                    return logger.error(err);

                } else {
                    logger.info("Release created: ", release);
                    return res.json(release);
                }
            })
    };

    var update = function (release, content) {
        release.content = content;

        release.save(function(err, release) {
            if (err) {
                return logger.error(err);
            } else {
                logger.info("Release updated:", release);
                return res.json(release);
            }
        });
    }

    Release.find()
        .where({ project: project, version: version})
        .exec(function (err, releases) {
            if (releases.length > 0) {
                var release = releases[0];
                update(release, content);
            }
            else {
                create();
            }
        });

};