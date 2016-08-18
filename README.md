# js_marc2003

My fork of [js-marc2003](https://github.com/19379/js-marc2003) that contains some fixes and improvements in most cases for last.fm scrobbler.

Main changes:

* Add compatibility with database populated by old WSH Panel Mod
* Able to perform playcount sync only (without scrobbling)
* Fix scrobbler button behavior
* Make it work on Linux

## Requirements:

1. [JScript Panel component](https://github.com/19379/foo-jscript-panel/releases)

1. For Last.fm functionality: [Custom Database component](https://hydrogenaud.io/index.php/topic,75306.0.html)

    1. Add two fields:

        * `LASTFM_LOVED_DB`. Key: `$crc32($lower(%artist%%title%))`
        * `LASTFM_PLAYCOUNT_DB`. Key: `$crc32($lower(%artist%%title%))`

    1. Add actions:

        * `Customdb Love 1`. Field: `LASTFM_LOVED_DB`. Update: `Contexmenu`. Set value: `1`.
        * `Customdb Love 0`. Field: `LASTFM_LOVED_DB`. Update: `Contexmenu -> Erase`.
        * `Customdb Delete Playcount`. Field `LASTFM_PLAYCOUNT_DB`. Update: `Contexmenu -> Erase`.
        * `Customdb Refresh`. Field `LASTFM_PLAYCOUNT_DB`. Update: `Contexmenu`. Set value: `[%LASTFM_PLAYCOUNT_DB%]`.

## Make it work on Linux via Wine:

1. Install winetricks and some of its components:

    * to support JScript:

        ```
        :~$ winetricks wsh57
        ```

    * to support `ActiveXObject` object:

        ```
        :~$ winetricks ie6_full
        ```

1. Import json2.js lib before other imports in script files

    ```
    // ==PREPROCESSOR==
    …
    // @import "%fb2k_profile_path%js_marc2003\js\json2.js"
    …
    // ==/PREPROCESSOR==
    ```

1. After performing "Library import" it cannot run bat file from the application to update the database.
So execute `update_db.sh` manually.
This will execute `lastfm_sql.cmd` and will update `customdb_sqlite.db` with a query stored in `wsh_data/lastfm.sql`.

---

scripts for foobar2000 + JScript Panel

https://github.com/19379/js-marc2003/wiki/Installation
