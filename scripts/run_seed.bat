@echo off
set PYTHONPATH=.
echo Resetting DB...
flask --app backend.app seed reset --force
echo Running demo seed...
flask --app backend.app seed demo
echo Done!
