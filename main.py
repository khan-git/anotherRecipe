# -*- coding: iso-8859-1 -*-

import os
import shutil
import datetime
import sqlite3
from flask import Flask, request, session, render_template, g, redirect, url_for, abort, flash, make_response
from random import randint
import json
import urllib2
import json
from json.decoder import JSONObject
from werkzeug.utils import secure_filename

UPLOAD_FOLDER = '/tmp'
ALLOWED_EXTENSIONS = set(['txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif'])

DBBACKUPPATH = os.path.abspath('db_backup')

if os.path.exists(DBBACKUPPATH) == False:
    os.mkdir(DBBACKUPPATH)

app = Flask(__name__)
#app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1] in ALLOWED_EXTENSIONS
app = Flask(__name__)
app.config.from_object(__name__)

# Load default config and override config from an environment variable
app.config.update(dict(
    DATABASE=os.path.join(app.root_path, 'recipes.db'),
    SECRET_KEY='development key',
    USERNAME='admin',
    PASSWORD='default',
    UPLOAD_FOLDER='/tmp'
))

app.config['UPPLOAD_FOLDER'] = '/tmp'

app.config.from_envvar('FLASKR_SETTINGS', silent=True)

def connect_db():
    """Connects to the specific database."""
    if os.path.exists(app.config['DATABASE']) == False:
        cmd = 'sqlite3 recipes.db < database.sql'
        os.system(cmd)
    rv = sqlite3.connect(app.config['DATABASE'])
    rv.row_factory = sqlite3.Row
    return rv

def get_db():
    """Opens a new database connection if there is none yet for the
    current application context.
    """
    if not hasattr(g, 'sqlite_db'):
        g.sqlite_db = connect_db()
    return g.sqlite_db

@app.teardown_appcontext
def close_db(error):
    """Closes the database again at the end of the request."""
    if hasattr(g, 'sqlite_db'):
        g.sqlite_db.close()

def init_db():
    db = get_db()
    with app.open_resource('database.sql', mode='r') as f:
        db.cursor().executescript(f.read())
    db.commit()

def queryDbFetchOne(query):
    """Query database, return one result"""
    db = get_db()
    cur = db.cursor()
    cur.execute(query)
    return cur.fetchone()

def queryDbFetchAll(query):
    """Query database, return one result"""
    db = get_db()
    cur = db.cursor()
    cur.execute(query)
    return cur.fetchall()

def getRecipe(recipeKey):
    """Get recipe data"""
    return queryDbFetchOne('SELECT * FROM recipes WHERE key="%s"'%recipeKey)

def getIngredients(recipeKey):
    """Get all ingredients for a recipe"""
    return queryDbFetchAll('SELECT * FROM recipeAmount WHERE recipeKey="%s"'%recipeKey)

def getNextKey():
    """Get next number for key"""
    currentHighKey = queryDbFetchOne('SELECT key FROM recipes ORDER BY key DESC')
    if currentHighKey is None:
        print "IS none %s"%currentHighKey
        currentHighKey = 0
    else:
        currentHighKey = int(currentHighKey[0])
    return currentHighKey +1

def insertIntoDb(table, names, values):
    """Insert into database"""
    if len(values) != len(names):
        return None
    
    query = 'INSERT INTO %s (%s) VALUES(%s)'%(table, ', '.join(names), ', '.join(values))
    rowId = None
    try:
        db = get_db()
        cur = db.cursor()
        cur = get_db().cursor()
        cur.execute(query)
        db.commit()
        rowId = cur.lastrowid
    except:
        db.rollback()
    finally:
        return rowId

def doRawQuery(query):
    """Do a raw query"""
    rowId = None
    try:
        db = get_db()
        cur = db.cursor()
        cur = get_db().cursor()
        cur.execute(query)
        db.commit()
        rowId = cur.lastrowid
    except:
        db.rollback()
    
    finally:
        return rowId

def updateDb(table, names, values, where):
    """Update row in table"""
    if len(values) != len(names):
        return None
    
    query = 'UPDATE %s SET '%(table)
    qPairs = []
    for name, value in zip(names,values):
        qPairs.append('%s=%s'%(name,value))
    query += ', '.join(x for x in qPairs)
    query += ' %s'%where
    rowId = None
    try:
        db = get_db()
        cur = db.cursor()
        cur = get_db().cursor()
        cur.execute(query)
        db.commit()
        rowId = cur.lastrowid
    except:
        db.rollback()
    finally:
        return rowId
    
@app.route('/prepdb')
def prepdb():
    """Prepare database from json file"""
    f = open('recipes.json','r')
    buff = f.read()
    recipes = json.loads(buff)
    for item in recipes:
        recipeKey = getNextKey()
        rowId = insertIntoDb('recipes', ['key', 'title','instructions', 'portions'],
                     [recipeKey, '"%s"'%item['title'], '"%s"'%item['instructions'], item['portions']])
        for ingredient in item['ingredients']:
            keys = ingredient.keys()
            keys.insert(0, 'recipeKey')
            values = ingredient.values()
            values.insert(0, recipeKey)
            rId = insertIntoDb('recipeAmount', keys, values)
        for group in item['recipeTag']:
            insertIntoDb('recipeTag', ['recipeKey', 'group'], [recipeKey, '"%s"'%group])
        if 'fridge' in item:
            insertIntoDb('fridge', ['recipeKey', 'portions'], [recipeKey, item['fridge']])
            print " Fridge %d"%item['fridge']
        else:
            print "No fridge"
    return index()
        
@app.cli.command('initdb')
def initdb_command():
    """Initializes the database."""
    init_db()
    print 'Initialized the database.'

@app.route('/help')
def help():
    values = {'pageId': 'help',
              'popupMenuId': 'popupMenuId%d'%randint(1, 1048)
              }
    return render_template('help.html', **values)

@app.route('/')
def index():
    values = {'pageId': 'index',
              'popupMenuId': 'popupMenuId%d'%randint(1, 1048)
              }
    return render_template('index.html', **values)
#    return redirect('login', code=304)
    
@app.route('/login', methods=['GET','POST'])
def login():
    error = None
    if request.method == 'POST':
        if request.form['username'] != 'admin' or request.form['password'] != 'admin':
            error = 'Invalid Credentials. Please try again.'
        else:
            return redirect(url_for('favourite'), code=304)
    values = {'pageId': 'index',
              'popupMenuId': 'popupMenuId%d'%randint(1, 1048),
              'error': error
              }
    return render_template('login.html', **values)

@app.route('/editRecipe', methods=['GET'])
def editRecipe():
    return newRecipe(request.args['recipeKey'])

@app.route('/deleteRecipe', methods=['GET'])
def deleteRecipe():
    # TODO
    if 'recipeKey' in request.args:
        pass
    pass

def deleteAmount(recipeKey):
    query = 'DELETE FROM recipeAmount WHERE recipeKey=%s'%recipeKey
    try:
        db = get_db()
        cur = db.cursor()
        cur = get_db().cursor()
        cur.execute(query)
        db.commit()
        rowId = cur.lastrowid
    except:
        db.rollback()
        msg = "error in delete operation"
        print msg
    
    finally:
        return rowId

@app.route('/newRecipe')
def newRecipe(recipeKey=None):
    if recipeKey is not None:
        recipe = getRecipe(recipeKey)
        ingredients = getIngredients(recipeKey)
    else:
        recipe = None
        ingredients = None
    entries = queryDbFetchAll('SELECT name FROM ingredients ')
    measurements = queryDbFetchAll('SELECT short FROM measurements ')
    values = {'ingredientsList': entries,
              'measurements':measurements,
              'recipe':recipe,
              'ingredients':ingredients,
              'pageId': 'newRecipe',
              'popupMenuId': 'popupMenuId%d'%randint(1, 1048)
              }
    return render_template('newRecipe.html', **values)

@app.route('/error')
def errorHtml():
    values = {'pageId': 'error',
              'popupMenuId': 'popupMenuId%d'%randint(1, 1048)
              }
    return render_template('error.html', **values)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1] in ALLOWED_EXTENSIONS

@app.route('/saveRecipe', methods=['POST'])
def saveRecipe():
    # TODO add last update time
    title = request.form['title']
    names = ['title']
    values = ['"%s"'%title]
    if 'instructions' in request.form:
        names.append('instructions')
        values.append('"%s"'%request.form['instructions'])
    if 'portions' in request.form:
        names.append('portions')
        values.append(request.form['portions'])
     
    if 'recipeKey' in request.form:
        recipeKey = request.form['recipeKey']
        updateDb('recipes', names, values, 'WHERE key=%s'%recipeKey)
    else:
        recipeKey = getNextKey()
        names.insert(0, 'key')
        values.insert(0, '%d'%recipeKey)
        if insertIntoDb('recipes', names, values) is None:
            return json.dumps({'redirect':'false', 'result': 'Error creating recipe'})
     
    amount = request.form.getlist('amount')
    measurement = request.form.getlist('measurement')
    ingredients = request.form.getlist('ingredient')
    deleteAmount(recipeKey)
    for a,m,i in zip(amount, measurement, ingredients):
        names =  ['recipeKey', 'ingredient', 'amount', 'measurement']
        values = [str(recipeKey), '"%s"'%i, str(a), '"%s"'%m]
        if insertIntoDb('recipeAmount', names, values) is None:
            return json.dumps({'redirect':'false', 'result': 'Error creating recipe'})
    return json.dumps({'redirect':True, 'url': '/show/recipe?recipe=%s'%recipeKey})

@app.route('/show/recipe', methods=['GET'])
def showRecipe():
    recipeKey = request.args.get('recipe')
    recipe = getRecipe(recipeKey)
    return displayRecipe(recipe)

def displayRecipe(recipe):
    values = {'key':recipe['key'],
              'title': recipe['title'],
              'instructions': recipe['instructions'],
              'portions': recipe['portions'],
              'ingredients': getIngredients(recipe['key']),
              'pageId': 'displayRecipe',
              'popupMenuId': 'popupMenuId%d'%randint(1, 1048)
              }
    
    return render_template('displayRecipe_template.html', **values)

@app.route('/randomRecipe', methods=['GET'])
def randomRecipe():
    recipes = queryDbFetchAll('SELECT * FROM recipes ORDER BY RANDOM() LIMIT 4')
    return render_template('listRecipes.html', header='F&ouml;rslag:', lastRecipes=recipes)

@app.route('/menuSuggestion', methods=['GET'])
def menuSuggestion():
    recipes = queryDbFetchAll('SELECT * FROM recipes ORDER BY RANDOM() LIMIT 4')
    if 'update' in request.args:
        return render_template('onlyList.html', lastRecipes=recipes)
    
    values = {'pagetitle':'Receptakuten',
              'title': 'F&ouml;rslag:',
              'lastRecipes': recipes,
              'refresh': 'true',
              'pageId': 'menuSuggestion',
              'popupMenuId': 'popupMenuId%d'%randint(1, 1048)
              }
    return render_template('listRecipes.html', **values)

@app.route('/ajax/search', methods=['GET'])
def searchAjax():
    if request.method == 'GET':
        patterns = request.args.getlist('searchPatterns[]')
        query = ''
        for p in patterns:
            if len(query) > 0:
                query = '%s or '%query
            query += 'title LIKE "%%%s%%" or instructions LIKE "%%%s%%"'%(p, p)
        query = 'SELECT key, title FROM recipes WHERE %s LIMIT 10'%query
        results = queryDbFetchAll(query)
        t = []
        for p in results:
            h = {}
            for k in p.keys():
                h[k] = p[k]
            t.append(h)
        return json.dumps(t)

@app.route('/ajax/searchIngredient', methods=['GET'])
def searchIngredient():
    if request.method == 'GET':
        patterns = request.args.getlist('searchPatterns[]')
        print patterns
        query = ''
        for p in patterns:
            if len(query) > 0:
                query = '%s or '%query
            query += 'ingredient LIKE "%%%s%%"'%(p)
        query = 'SELECT DISTINCT ingredient FROM recipeAmount WHERE %s'%query
        print query
        results = queryDbFetchAll(query)
        t = []
        for p in results:
            h = {}
            for k in p.keys():
                h[k] = p[k]
            t.append(h)
        return json.dumps(t)

@app.route('/search')
def search():
    values = {'pageId': 'search',
              'popupMenuId': 'popupMenuId%d'%randint(1, 1048)
              }
    return render_template('search.html', **values)
    
def getFridgeJSON():
    fridgeContent = queryDbFetchAll('SELECT key, title, fridge.portions AS portions FROM recipes INNER JOIN fridge ON recipes.key = fridge.recipeKey')
    fridgeJson = []
    for row in fridgeContent:
        rowJson = {}
        for key in row.keys():
            rowJson[key] = row[key]
        fridgeJson.append(rowJson)
    return json.dumps(fridgeJson)

@app.route('/fromTheFridge')
def fromTheFridge():
    values = {'pageId': 'fromTheFridge',
              'popupMenuId': 'popupMenuId%d'%randint(1, 1048)
              }
    return render_template('whatsinthefridge.html', **values)

# Update fridge content
@app.route('/ajax/updateFridge', methods=['GET','POST'])
def updateFridge():
    if request.method == 'POST':
        recipesJson = request.form.getlist('recipes')
        recipes = json.loads(recipesJson[0])
        keys = []
        for item in recipes:
            keys.append(item['key'])
            queryUpdate = 'UPDATE fridge SET portions=%d WHERE recipeKey=%d'%(item['portions'], item['key'])
            queryInsert = 'INSERT INTO fridge (recipeKey, portions) SELECT %d,%d WHERE(Select Changes() = 0)'%(item['key'], item['portions'])
            doRawQuery(queryUpdate)
            doRawQuery(queryInsert)
        currentKeys = queryDbFetchAll('SELECT recipeKey FROM fridge ORDER BY recipeKey')
        for key in currentKeys:
            if key['recipeKey'] not in keys:
                deleteQuery = 'DELETE FROM fridge WHERE recipeKey=%s'%key['recipeKey']
                doRawQuery(deleteQuery)
    return getFridgeJSON()


@app.route('/groceryList')
def groceryList():
    recipes = queryDbFetchAll('SELECT key, title, portions FROM recipes ORDER BY title')
    ingredients = {}
    for recipe in recipes:
        ingredients[recipe['key']] = getIngredients(recipe['key'])
    values = {'pageId': 'groceryList',
              'recipes': recipes,
              'ingredients': ingredients,
              'popupMenuId': 'popupMenuId%d'%randint(1, 1048)
               }
    return render_template('groceryList.html', **values)


@app.route('/favourite')
def favourite():
    """Show favourite recipes"""
    values = {'pageId': 'favouritePage',
              'popupMenuId': 'popupMenuId%d'%randint(1, 1048)
               }
    return render_template('favourite.html', **values)
    
@app.route('/ajax/getRecipesJson', methods=['GET','POST'])
def getRecipesJson():
    if request.method == 'POST':
        recipeKeys = request.form.getlist('recipe')
        query = 'SELECT * FROM recipes where '
        qyeryKeys = []
        for recipes in recipeKeys:
            jsonKeys = json.loads(recipes)
            for key in jsonKeys:
                qyeryKeys.append('key=%s'%key['recipeKey'])
        query += ' OR '.join(qyeryKeys)
        recipeList = queryDbFetchAll(query)
        jsonReply = []
        for rowRecipe in recipeList:
            tmpJson = {}
            for key in rowRecipe.keys():
                tmpJson[key] = rowRecipe[key]
            ingredientsJson = []
            for row in getIngredients(rowRecipe['key']):
                tmpIngredient = {}
                for key in row.keys():
                    if key == 'recipeKey':
                        continue
                    tmpIngredient[key] = row[key]
                ingredientsJson.append(tmpIngredient)
            tmpJson['ingredients'] = ingredientsJson
            jsonReply.append(tmpJson)
        return json.dumps(jsonReply)
    
    recipes = queryDbFetchAll('SELECT key, title FROM recipes')
    rows = []
    for i in recipes:
         rows.append(dict(i))
    return json.dumps(rows)

@app.route('/manifest.json')
def manifestJSON():
    return url_for('static', filename='manifest.json')

@app.route('/manifest.appcache')
def manifest():
    res = make_response(render_template('manifest.appcache'), 200)
    res.headers["Content-Type"] = "text/cache-manifest"
    return res

@app.route('/admin/restore', methods = ['POST'])
def dorestore():
    versionF = os.path.abspath(os.path.join(DBBACKUPPATH, request.form.get('version')))
    if os.path.exists(versionF):
        now = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        name = '%s_bfrestore.sql'%now
        dobackup(name)
        tables = queryDbFetchAll('SELECT name FROM sqlite_master WHERE type = "table"')
        for tab in tables:
            doRawQuery('DROP TABLE %s'%tab['name'])
        cmd = 'sqlite3 recipes.db < %s'%versionF
        os.system(cmd)
    return getstatus()

@app.route('/admin/backup')
def adminbackup():
    now = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    dobackup(now+'.sql')
    return getstatus()

def dobackup(name):
    dbF =  open(os.path.join(DBBACKUPPATH, name), 'w')
    con = get_db()
    dbF.write('\n'.join(con.iterdump()).encode('utf8'))
    dbF.close()

@app.route('/admin/status')
def getstatus():
    status = {}
    status['num_of_recipes'] = queryDbFetchOne('SELECT count(*) as rows FROM recipes')['rows']
    status['num_of_fridge'] = queryDbFetchOne('SELECT count(*) as rows FROM fridge')['rows']
    status['num_of_ingredients'] = queryDbFetchOne('SELECT count(*) as rows FROM (SELECT DISTINCT ingredient FROM recipeAmount)')['rows']
    status['backups'] = sorted(os.listdir(DBBACKUPPATH), reverse=True)
    return json.dumps(status, sort_keys=True, indent=4, separators=(',', ': '))

@app.route('/admin')
def adminpage():
    values = {'pageId': 'adminPage',
              'popupMenuId': 'popupMenuId%d'%randint(1, 1048)
            }
    return render_template('admin.html', **values)

if __name__ == "__main__":
#     import logging
#     file_handler = RotatingFileHandler('/tmp/receptakuten.log', bakupCount=5)
#     file_handler.setLevel(logging.WARNING)
#     app.logger.addHandler(file_handler)
    app.run(host="0.0.0.0", debug=True)
#    app.run(debug=True)
