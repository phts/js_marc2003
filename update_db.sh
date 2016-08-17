#!/bin/bash

function windows_short_path {
  local rp=`realpath "$1"`
  local winpath=`winepath -w "$rp"`
  echo `winepath -s "$winpath"`
}

echo `windows_short_path "lastfm_sql.cmd"`
echo `windows_short_path "sqlite3.exe"`
echo `windows_short_path "../customdb_sqlite.db"`
echo `windows_short_path "../wsh_data/lastfm.sql"`

wineconsole `windows_short_path "lastfm_sql.cmd"` \
            `windows_short_path "sqlite3.exe"` \
            `windows_short_path "../customdb_sqlite.db"` \
            `windows_short_path "../wsh_data/lastfm.sql"`
