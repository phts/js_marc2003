_.mixin({
	scrobbler : function (x, y, size) {
		this.notify_data = function (name, data) {
			if (name == "2K3.NOTIFY.LOVE")
				this.post(_.tf("%LASTFM_LOVED_DB%", data) == 1 ? "track.unlove" : "track.love", data);
		}

		this.playback_new_track = function () {
			this.metadb = fb.GetNowPlaying();
			this.time_elapsed = 0;
			this.timestamp = _.floor(_.now() / 1000);
			this.target_time = Math.min(_.ceil(fb.PlaybackLength / 2), 240);
		}

		this.playback_time = function () {
			this.time_elapsed++;
			switch (true) {
			case !this.enabled:
				return;
			case this.time_elapsed == 2 && fb.IsMetadbInMediaLibrary(this.metadb):
				this.post("track.updateNowPlaying", this.metadb);
				break;
			case this.time_elapsed == this.target_time:
				if (!fb.IsMetadbInMediaLibrary(this.metadb)) {
					panel.console("Skipping... Track not in Media Library.");
				} else if (fb.PlaybackLength < this.min_length) {
					panel.console("Not submitting. Track too short.");
					// still check to see if a track is loved even if it is too short to scrobble
					this.get("track.getInfo", this.metadb);
				} else {
					this.attempt = 1;
					this.post("track.scrobble", this.metadb);
				}
				break;
			}
		}

		this.playcount_sync = function () {
			this.time_elapsed++;
			switch (true) {
			case !this.enabled:
				return;
			case this.time_elapsed == this.target_time:
				if (!this.loved_working && !this.playcount_working)
					this.get("track.getInfo", fb.GetNowPlaying());
				break;
			}
		}

		this.post = function (method, metadb) {
			switch (true) {
			case this.loved_working:
			case this.playcount_working:
				return;
			case lastfm.api_key.length != 32:
				return panel.console("Last.fm API KEY not set.");
			case lastfm.secret.length != 32:
				return panel.console("Last.fm SECRET not set.");
			case lastfm.username.length == 0:
				return panel.console("Last.fm Username not set.");
			case lastfm.sk.length != 32:
				return panel.console("Last.fm Password not set.");
			}
			var artist = _.tf("%artist%", metadb);
			var track = _.tf("%title%", metadb);
			var album = _.tf("[%album%]", metadb);
			var duration = _.round(metadb.Length);
			if (!_.tagged(artist) || !_.tagged(track))
				return;
			switch (method) {
			case "track.love":
			case "track.unlove":
				panel.console("Attempting to " + (method == "track.love" ? "love " : "unlove ") + _.q(track) + " by " + _.q(artist));
				panel.console("Contacting Last.fm....");
				var api_sig = md5("api_key" + lastfm.api_key + "artist" + artist + "method" + method + "sk" + lastfm.sk + "track" + track + lastfm.secret);
				var post_data = "sk=" + lastfm.sk + "&artist=" + encodeURIComponent(artist) + "&track=" + encodeURIComponent(track);
				break;
			case "track.scrobble":
				var api_sig = md5("album" + album + "api_key" + lastfm.api_key + "artist" + artist + "duration" + duration + "method" + method + "sk" + lastfm.sk + "timestamp" + this.timestamp + "track" + track + lastfm.secret);
				var post_data = "format=json&sk=" + lastfm.sk + "&duration=" + duration + "&timestamp=" + this.timestamp + "&album=" + encodeURIComponent(album) + "&artist=" + encodeURIComponent(artist) + "&track=" + encodeURIComponent(track);
				break;
			case "track.updateNowPlaying":
				var api_sig = md5("api_key" + lastfm.api_key + "artist" + artist + "duration" + duration + "method" + method + "sk" + lastfm.sk + "track" + track + lastfm.secret);
				var post_data = "format=json&sk=" + lastfm.sk + "&duration=" + duration + "&artist=" + encodeURIComponent(artist) + "&track=" + encodeURIComponent(track);
				break;
			default:
				return;
			}
			post_data += "&method=" + method + "&api_key=" + lastfm.api_key + "&api_sig=" + api_sig;
			this.xmlhttp.open("POST", "https://ws.audioscrobbler.com/2.0/", true);
			this.xmlhttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
			this.xmlhttp.setRequestHeader("User-Agent", this.ua);
			this.xmlhttp.send(post_data);
			this.xmlhttp.onreadystatechange = _.bind(function () {
				if (this.xmlhttp.readyState == 4) {
					if (this.xmlhttp.status == 200) {
						this.success(method, metadb);
					} else {
						panel.console("HTTP error: " + this.xmlhttp.status);
						this.xmlhttp.responsetext && fb.trace(this.xmlhttp.responsetext);
					}
				}
			}, this);
		}

		this.get = function (method, metadb, p) {
			if (lastfm.api_key.length != 32)
				return panel.console("Last.fm API KEY not set.");
			if (lastfm.username.length == 0)
				return panel.console("Last.fm Username not set.");
			var url = lastfm.get_base_url() + "&method=" + method;
			switch (method) {
			case "track.getInfo":
				if (this.loved_working || this.playcount_working)
					return;
				var artist = _.tf("%artist%", metadb);
				var track = _.tf("%title%", metadb);
				if (!_.tagged(artist) || !_.tagged(track))
					return;
				// must use autocorrect now even when it is disabled on website
				url += "&username=" + lastfm.username + "&artist=" + encodeURIComponent(artist) + "&track=" + encodeURIComponent(track) + "&autocorrect=1&s=" + _.now();
				break;
			case "user.getLovedTracks":
				if (!this.loved_working)
					return panel.console("Import aborted.");
				this.page = p;
				url += "&limit=200&user=" + lastfm.username + "&page=" + this.page;
				break;
			case "user.getTopTracks":
				if (!this.playcount_working)
					return panel.console("Import aborted.");
				this.page = p;
				url += "&limit=100&user=" + lastfm.username + "&page=" + this.page
				break;
			}
			this.xmlhttp.open("GET", url, true);
			this.xmlhttp.setRequestHeader("User-Agent", lastfm.ua);
			this.xmlhttp.setRequestHeader("If-Modified-Since", "Thu, 01 Jan 1970 00:00:00 GMT");
			this.xmlhttp.send();
			this.xmlhttp.onreadystatechange = _.bind(function () {
				if (this.xmlhttp.readyState == 4) {
					if (this.xmlhttp.status == 200) {
						this.success(method, metadb);
					} else {
						panel.console("HTTP error: " + this.xmlhttp.status);
						this.xmlhttp.responsetext && fb.trace(this.xmlhttp.responsetext);
						if (p == 1) {
							this.loved_working = false;
							this.playcount_working = false;
						}
					}
				}
			}, this);
		}

		this.success = function (method, metadb) {
			switch (method) {
			case "track.love":
			case "track.unlove":
				if (this.xmlhttp.responsetext.indexOf("ok") > -1) {
					panel.console("Track " + (method == "track.love" ? "loved successfully." : "unloved successfully."));
					fb.RunContextCommandWithMetadb("Customdb Love " + (method == "track.love" ? 1 : 0), metadb, 8);
				} else {
					panel.console(this.xmlhttp.responsetext);
				}
				break;
			case "track.scrobble":
				var data = _.jsonParse(this.xmlhttp.responsetext);
				if (data.error) {
					panel.console(data.message);
				} else {
					data = _.get(data, 'scrobbles["@attr"]', []);
					if (data.ignored == 1)
						panel.console("Track not scrobbled. The submission server refused it possibly because of incomplete tags or incorrect system time.");
					else if (data.accepted == 1)
						panel.console("Track scrobbled successfully.");
					else {
						if (this.attempt == 1)
							panel.console("Unexpected submission server response.");
						if (this.attempt < 5) {
							this.attempt++;
							panel.console("Retrying...");
							window.SetTimeout(_.bind(function () {
								this.post(method, metadb);
							}, this), 1000);
						} else {
							panel.console("Submission failed.");
						}
						return;
					}
					if (!this.loved_working && !this.playcount_working) {
						panel.console("Now fetching playcount...");
						window.SetTimeout(_.bind(function () {
							this.get("track.getInfo", metadb);
						}, this), 1000);
					}
				}
				break;
			case "track.updateNowPlaying":
				var data = _.jsonParse(this.xmlhttp.responsetext);
				if (data.error)
					panel.console(data.message);
				else if (_.get(data, "nowplaying.ignoredMessage.code") == 0)
					panel.console("Now playing notification updated ok.");
				break;
			case "track.getInfo":
				var data = _.jsonParse(this.xmlhttp.responsetext);
				if (data.error)
					return panel.console(data.message);
				if (!data.track)
					return panel.console("Unexpected server error.");
				fb.RunContextCommandWithMetadb("Customdb Love " + (data.track.userloved == 1 ? 1 : 0), metadb, 8);
				if (fb.PlaybackLength < this.min_length)
					return;
				var old_playcount = _.parseInt(_.tf("$if2(%LASTFM_PLAYCOUNT_DB%,0)", metadb));
				var new_playcount = data.track.userplaycount > 0 ? _.parseInt(data.track.userplaycount) : 0;
				new_playcount += 1;
				switch (true) {
				case new_playcount < old_playcount:
					panel.console("Playcount returned from Last.fm is lower than current value. Not updating.");
					break;
				case new_playcount == old_playcount:
					panel.console("No changes found. Not updating.");
					break;
				default:
					this.update_playcount(metadb, new_playcount);
					break;
				}
				break;
			case "user.getLovedTracks":
				var data = _.jsonParse(this.xmlhttp.responsetext);
				if (this.page == 1) {
					if (data.error) {
						this.loved_working = false;
						return panel.console("Last.fm server error:\n\n" + data.message);
					}
					this.pages = data.lovedtracks["@attr"].totalPages;
				}
				data = _.get(data, "lovedtracks.track", []);
				if (data.length) {
					_.forEach(data, function (item) {
						var artist = item.artist.name;
						var title = item.name;
						var url = _.tfe("$crc32($lower(" + _.fbEscape(artist + title) + "))", true);
						panel.console(this.r + ": " + artist + " - " + title);
						this.sql += "INSERT OR REPLACE INTO quicktag(url,subsong,fieldname,value) VALUES('" + url + "','-1','LASTFM_LOVED_DB','1');\r\n";
						this.r++;
					}, this);
					panel.console("Loved tracks: completed page " + this.page + " of " + this.pages);
				} else if (this.pages > 0) {
					this.loved_page_errors++;
				}
				if (this.page < this.pages) {
					this.page++;
					this.get("user.getLovedTracks", null, this.page);
				} else {
					this.loved_working = false;
					this.playcount_working = true;
					this.pages = 0;
					this.r = 1;
					this.get("user.getTopTracks", null, 1);
				}
				break;
			case "user.getTopTracks":
				var data = _.jsonParse(this.xmlhttp.responsetext);
				if (this.page == 1) {
					if (data.error) {
						this.playcount_working = false;
						return panel.console("Last.fm server error:\n\n" + data.message);
					}
					this.pages = data.toptracks["@attr"].totalPages;
				}
				data = _.get(data, "toptracks.track", []);
				if (data.length) {
					_.forEach(data, function (item) {
						var playcount = item.playcount;
						if (playcount > 0) {
							var artist = item.artist.name;
							var title = item.name;
							var url = _.tfe("$crc32($lower(" + _.fbEscape(artist + title) + "))", true);
							panel.console(this.r + ": " + artist + " - " + title + " " + playcount);
							this.sql += "INSERT OR REPLACE INTO quicktag(url,subsong,fieldname,value) VALUES('" + url + "','-1','LASTFM_PLAYCOUNT_DB','" + playcount + "');\r\n";
							this.r++;
						}
					}, this);
					panel.console("Playcount: completed page " + this.page + " of " + this.pages);
				} else if (this.pages > 0) {
					this.playcount_page_errors++
				}
				if (this.page < this.pages) {
					this.page++;
					this.get("user.getTopTracks", null, this.page);
				} else {
					this.playcount_working = false;
					if (this.sql == "BEGIN TRANSACTION;\r\n") {
						panel.console("Nothing found to import.");
					} else {
						this.sql += "COMMIT;";
						var ts = fso.OpenTextFile(this.sql_file, 2, true, 0);
						ts.WriteLine(this.sql);
						ts.Close();
						this.finish_import();
					}
				}
				break;
			}
		}

		this.update_playcount = function (metadb, new_value) {
			fb.RunContextCommandWithMetadb("Customdb Delete Playcount", metadb, 8);
			window.SetTimeout(_.bind(function () {
				var crc32 = _.tf("$crc32($lower(%artist%%title%))", metadb);
				var cmd = _.shortPath(this.sqlite3_file) + " " + _.shortPath(this.db_file) + " \"INSERT INTO quicktag(url,subsong,fieldname,value) VALUES('" + crc32 + "','-1','LASTFM_PLAYCOUNT_DB','" + new_value + "');\"";
				var attempt = 1;
				while (_.tf("%LASTFM_PLAYCOUNT_DB%", metadb) != new_value && attempt <= 10) {
					if (attempt !== 1) {
						panel.console("Attempt: " + attempt);
					}
					_.runCmd(cmd, true);
					attempt++;
				}
				if (_.tf("%LASTFM_PLAYCOUNT_DB%", metadb) == new_value) {
					panel.console("Database updated successfully.");
					fb.RunContextCommandWithMetadb("Customdb Refresh", metadb, 8);
				} else {
					panel.console("Database error. Playcount not updated.");
				}
			}, this), 250);
		}

		this.start_import = function () {
			fb.ShowConsole();
			this.loved_page_errors = 0;
			this.playcount_page_errors = 0;
			this.pages = 0;
			this.r = 1;
			this.sql = "BEGIN TRANSACTION;\r\n";
			this.loved_working = true;
			panel.console("Starting import...");
			this.get("user.getLovedTracks", null, 1);
		}

		this.finish_import = function () {
			if (this.loved_page_errors + this.playcount_page_errors > 0) {
				panel.console("Loved track page errors: " + this.loved_page_errors + " (200 records are lost for every page that fails.)");
				panel.console("Playcount page errors: " + this.playcount_page_errors + " (100 records are lost for every page that fails.)");
			} else {
				panel.console("There were no errors reported.");
			}
			_.run(_.shortPath(this.cmd_file), _.shortPath(this.sqlite3_file), _.shortPath(this.db_file), _.shortPath(this.sql_file));
		}

		this.update_button = function () {
			var n = "mono\\appbar.warning.circle.png";
			switch (true) {
			case lastfm.username.length == 0:
				var tooltip = "Click to set your username.";
				break;
			case lastfm.api_key.length != 32:
				var tooltip = "Click to set your API key.";
				break;
			case !this.enabled:
				var tooltip = "Click to enable.";
				break;
			default:
				n = "mono\\appbar.social.lastfm.png";
				var tooltip = "Last.fm Settings";
				break;
			}
			buttons.buttons.scrobbler = new _.button(this.x, this.y, this.size, this.size, {normal : n}, _.bind(function () { this.menu(); }, this), tooltip);
			window.RepaintRect(this.x, this.y, this.size, this.size);
		}

		this.menu = function () {
			var m = window.CreatePopupMenu();
			var working = this.loved_working || this.playcount_working;
			var flag = working || lastfm.username.length == 0 ? MF_GRAYED : MF_STRING;
			m.AppendMenuItem(working ? MF_GRAYED : MF_STRING, 1, "Last.fm username...");
			m.AppendMenuItem(flag, 2, "Last.fm password...");
			m.AppendMenuItem(flag, 8, "Last.fm API key...");
			m.AppendMenuSeparator();
			m.AppendMenuItem(flag, 3, "Enabled");
			m.CheckMenuItem(3, this.enabled);
			m.AppendMenuSeparator();
			m.AppendMenuItem(working ? MF_GRAYED : MF_STRING, 4, "Library import");
			m.AppendMenuItem(working ? MF_STRING : MF_GRAYED, 9, "Abort");
			m.AppendMenuSeparator();
			m.AppendMenuItem(MF_STRING, 5, "Show loved tracks");
			m.AppendMenuSeparator();
			m.AppendMenuItem(lastfm.username.length ? MF_STRING : MF_GRAYED, 6, "View profile");
			var idx = m.TrackPopupMenu(this.x, this.y + this.size);
			switch (idx) {
			case 1:
				lastfm.update_username();
				break;
			case 2:
				lastfm.update_password();
				break;
			case 3:
				this.enabled = !this.enabled;
				window.SetProperty("2K3.SCROBBLER.ENABLED", this.enabled);
				this.update_button();
				break;
			case 4:
				this.start_import();
				break;
			case 5:
				fb.ShowLibrarySearchUI("%LASTFM_LOVED_DB% IS 1");
				break;
			case 6:
				_.browser("http://www.last.fm/user/" + lastfm.username);
				break;
			case 8:
				lastfm.update_api_key();
				break;
			case 9:
				this.loved_working = this.playcount_working = false;
				break;
			}
			m.Dispose();
		}

		this.interval_func = _.bind(function () {
			if (!this.loved_working && !this.playcount_working)
				return;
			if (this.page != this.last_page)
				return this.last_page = this.page;
			var tmp = this.page > 1 ? this.page - 1 : 1;
			this.xmlhttp.abort();
			if (this.loved_working)
				this.get("user.getLovedTracks", null, tmp);
			else if (this.playcount_working)
				this.get("user.getTopTracks", null, tmp);
		}, this);

		lastfm.scrobbler = this;
		_.createFolder(folders.data);
		_.createFolder(folders.settings);
		this.x = x;
		this.y = y;
		this.size = size;
		this.loved_working = false;
		this.playcount_working = false;
		this.min_length = 30;
		this.sqlite3_file = folders.home + "sqlite3.exe";
		this.cmd_file = folders.home + "lastfm_sql.cmd";
		this.db_file = fb.ProfilePath + "customdb_sqlite.db";
		this.sql_file = folders.data + "lastfm.sql";
		this.page = 0;
		this.last_page = 0;
		this.enabled = window.GetProperty("2K3.SCROBBLER.ENABLED", true);
		this.xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
		this.metadb = fb.GetNowPlaying();
		window.SetInterval(this.interval_func, 15000);
	}
});
