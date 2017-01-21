/*******************************************************
* Generic functions
********************************************************/
function sortByTitle(a,b) {
  if (a.title < b.title)
    return -1;
  if (a.title > b.title)
    return 1;
  return 0;
}

function getFavourite() {
    var jsonData = localStorage.getItem("favouriteRecipes");
    if(jsonData == null) {
        jsonData = '[]';
    }
    return jsonData;
}

function setFavourite(data) {
    localStorage.setItem("favouriteRecipes", data);
}

function getFromFridge() {
    var jsonData = localStorage.getItem("fromthefridge");
    if(jsonData == null) {
        jsonData = '{}';
    }
    return jsonData;
}

function putInFridge(data) {
    localStorage.setItem("fromthefridge", data);
}

function findSpanByData(list, data, value) {
    var index;
    for(index = 0; index < list.length; index += 1) {
        if( $(list[index]).data(data) == value) {
            return list[index];
        }
    }
    
    return null;
}

/* Expected format is [{'key':4, ...}]*/
function findKey(key, data) {
    var index;
    for (index = 0; index < data.length; index += 1) {
        if (data[index].key == key) {
            return data[index];
        }
    }
    return null;
}

function removeKey(key, data) {
    var index;
    for (index = 0; index < data.length; index += 1) {
        if (data[index].key == key) {
            data.splice(index, 1);
        }
    }
}

function updateKey(key, recipe, data) {
    var index;
    for (index = 0; index < data.length; index += 1) {
        if (data[index].key == key) {
            data[index] = recipe;
        }
    }
}

function createSelectRangeElement(classes) {
    var selectElem = $('<select class="myportions ' + classes + '" id="portions" data-mini="true" data-inline="true"/>'),
        j;
    
    for (j = 1; j < 25; j += 1) {
        selectElem.append($('<option values="' + j + '">' + j + '</option>'));
    }
    return selectElem;
}

/*******************************************************
* Page: fromTheFridge
********************************************************/
function displayFridgeContent(jsonData) {
    var recipes = JSON.parse(jsonData),
        recipeIndex,
        recipe,
        gridDiv = $('#fridgeList'),
        blockDiv;
    gridDiv.empty();
    if (jsonData === null) {
        return;
    }
    for (recipeIndex in recipes.sort(sortByTitle)) {
        recipe = recipes[recipeIndex];
        blockDiv = $('<div/>', {
            'class':'ui-block-a'
        }).append($('<a/>',{
            'class': 'ui-btn ui-icon-minus ui-btn-icon-notext ui-corner-all ui-btn-inline recipeCountMinus',
            'data-rel':'popup',
            'data-transition':'flip',
            'href':'#decreasePortionPopup'
        }).text("Ta bort").data('data-key', recipe.key));
        gridDiv.append(blockDiv);
        
        blockDiv = $('<div/>', {
            'class':'ui-block-b'
        }).append($('<a/>',{ 
            'class':'ui-btn ui-corner-all',
        }).text(recipe.title).append($('<span/>', {
            'class':'ui-li-count'
        }).text(recipe.portions)));
        gridDiv.append(blockDiv);

        blockDiv = $('<div/>', {
            'class':'ui-block-c onlineonly'
        }).append($('<a/>',{ 
            'class': 'ui-btn ui-icon-bars ui-btn-icon-notext ui-corner-all ui-btn-inline',
            'href':'/show/recipe?recipe=' + recipe.key
        }).text(recipe.title));
        if(isSiteOnline() == false) {
            blockDiv.hide();
        }
        gridDiv.append(blockDiv);
        $('#fridgeList').append(gridDiv).trigger('create');
    }
}

$(document).on("pageinit", "#fromTheFridge", function (event) {
    
    // Update count on plus click
    $(document).on('click', '.recipeCount', function (e) {
        var spanObj = $($(e.currentTarget).siblings('span')[0]),
            count;
        count = parseInt(spanObj.data('portions'));
        count += 1;
        spanObj.data('portions', count);
        spanObj.html('').html(count);
    });
    
    // Get currently stored fridge items
    if( isSiteOnline() == true) {
        $.get('/ajax/updateFridge', function (jsonData) {
            putInFridge(jsonData);
            displayFridgeContent(jsonData);
        });
    }
    else {
        displayFridgeContent(getFromFridge());
    }

    window.addEventListener("online", function(e) {
        // Update fridge server if we become online
        var jsonData = getFromFridge();
        $.post('/ajax/updateFridge', {
            'recipes':jsonData
        }, function (data) {
            putInFridge(data);
        });
    });

    // Store the updated portions
    $('#updatePortions').click(function (e) {
        var data = JSON.parse(getFromFridge()),
            recipe,
            select,
            key,
            jsonData;
        select = $(e.currentTarget).parents('.ui-content').find('select');
        key = select.data('data-key');
        recipe = findKey(key, data);
        if(parseInt(select.val()) == 0) {
            removeKey(key, data);
        }
        else {
            recipe.portions = parseInt(select.val());
            updateKey(key, recipe, data);
        }
        
        jsonData = JSON.stringify(data);
        putInFridge(jsonData);
        $.post('/ajax/updateFridge', {
            'recipes':jsonData
        }, function (data) {
            putInFridge(data);
        });
        displayFridgeContent(jsonData);
        return;
    });
    
    // Prepare popup for portions update on minus click
    $(document).on('click', '.recipeCountMinus', function (e) {
        var portions = JSON.parse(getFromFridge()),
            contentArea = $('#decreasePortionPopup').find('.ui-content').find('select'),
            recipe,
            i;
        recipe = findKey($(e.currentTarget).data('data-key'), portions);
        if (recipe === null) {
            // TODO Close popup
            return;
        }
        
        contentArea.data('data-key', $(e.currentTarget).data('data-key'));
        contentArea.empty();
        for (i = 0; i <= parseInt(recipe.portions); i += 1) {
            contentArea.append($('<option/>').prop('value',i).text(i));
        }
        i -= 1;
        contentArea.find('option[value=' +i + ']').prop('selected','selected');
        
        contentArea.selectmenu('refresh');
    });

    // Open panel and populate list
    $('#addFridgePanel').on('panelbeforeopen', function (e) {
       $.get('/ajax/getRecipesJson', function (data) {
           var recipes = JSON.parse(data);
           var selectList = $('#addFridgeContent'), 
               index,
               spanList,
               jsonData = getFromFridge(),
               storedRecipes;

           selectList.empty();
           for(index in recipes.sort(sortByTitle)) {
               var divRecipe = $('<div data-role="controlgroup" data-type="horizontal" class="recipeItem"/>'),
                   recipe = recipes[index];
               divRecipe.append($('<a/>', {
                   'class' : 'ui-btn ui-btn-icon-left ui-icon-plus ui-corner-all ui-btn-inline recipeCount',
                   'data-key' : recipe.key
                   }).text(recipe.title));
               divRecipe.append($('<span/>', {
                   'class' : 'ui-li-count',
                   'data-key' : recipe.key,
                   'data-title' : recipe.title
                   }).text('0').data('portions', 0));
               selectList.append($('<li/>').append(divRecipe));
           }
           if(jsonData == null) {
               jsonData = '[]';
           }
           storedRecipes = JSON.parse(jsonData);
           spanList = $('#addFridgeContent').find('span')
           for(index = 0; index < storedRecipes.length; index++) {
               var tmpRecipe = storedRecipes[index],
                   span;
               span = findSpanByData(spanList, 'key', tmpRecipe.key);
               $(span).data('portions', tmpRecipe.portions).text(tmpRecipe.portions);
           }

           selectList.trigger('create');
       }); 
    });
    
    // Close panel and get items with a count > 0.
    // Add to current fridge list
    $('#addFridgePanelClose').click(function (e) {
        var recipeKeys = $('#addFridgeContent').find('span'),
            recipeKeysJson = [],
            keysList = [],
            index;
        for(index = 0; index < recipeKeys.length; index += 1) {
            if( $(recipeKeys[index]).data('portions') > 0) {
                keysList.push(recipeKeys[index]);
            }
        }
        if(recipeKeys.length == 0) {
            putInFridge('[]');
            displayFridgeContent('[]');
            return;
        }
        
        for(var i=0; i < keysList.length; i++) {
          recipeKeysJson.push({
              'key':$(keysList[i]).data('key'), 
              'portions':$(keysList[i]).data('portions')
          })
        }
        $.post('/ajax/updateFridge', {
            'recipes':JSON.stringify(recipeKeysJson)
        }, function (data) {
            putInFridge(data);
            displayFridgeContent(data);
        });
        
    })
});

/*******************************************************
* Page: displayRecipe
********************************************************/
$( document ).on( "pageinit", "#displayRecipe", function(event) {
    $(document).on('focus', '.myportions', function (e) {
        $(e.currentTarget).data('data-oldportions', e.currentTarget.value);
    });
    $(document).on('change', '.myportions', function (e) {
        var amountValues = $(e.currentTarget).parents('.ui-content').find('.amountValue'),
            newPortions = parseInt(e.currentTarget.value),
            n,
            tmpValue,
            oneValue,
            newValue,
            previousPortions = $(e.currentTarget).data('data-oldportions');
        for(n = 0; n < amountValues.length; n += 1) {
            tmpValue = parseFloat(amountValues[n].innerHTML);
            oneValue = tmpValue/previousPortions;
            newValue = oneValue*newPortions;
            amountValues[n].innerHTML = newValue;
        }
    });
});

/*******************************************************
* Page: menuSuggestion
********************************************************/
$( document ).on( "pageinit", "#menuSuggestion", function(event) {
    $('#refreshButton').on('click', function (e) {
        $.get('/menuSuggestion', {'update':'true'}, function (data) {
            $('#listedRecipes').empty().append(data).trigger('create');
        });
    });
});

/*******************************************************
* Page: newRecipe
********************************************************/
function removeIngredient(id) {
    $('#' + id).remove();
    $('#ingredientsList').trigger('create');
}

var toast=function(msg){
	$("<div class='ui-loader ui-overlay-shadow ui-body-e ui-corner-all' data-theme='a'><h3>"+msg+"</h3></div>")
	.css({ display: "block", 
		opacity: 1, 
		position: "fixed",
		padding: "7px",
		"text-align": "center",
		width: "270px",
		left: ($(window).width() - 284)/2,
		top: $(window).height()/2 })
	.appendTo( $.mobile.pageContainer ).delay( 1500 )
	.fadeOut( 400, function(){
		$(this).remove();
	});
}

function addIngredient(e) {
    if (!$('#amount').val()) {
        console.log('Empty amount');
        toast("Stort fel");
        return;
    }
    var index = $('#ingredientsList div[class=ingredientsContainer]').length + 1,
        inputs = $('#popupIngredient').find('#amount, #measurement, #searchPattern'),
        divId = 'ingredients' + index,
        uigrid = ['a', 'b', 'c'],
        i = 0;
    $('#ingredientsList')
        .append(
            $('<div/>', {
                'id': divId,
                'class': 'ingredientsContainer'
            })
        ).trigger('create');

    for (i = 0; i < inputs.length; i = i + 1) {
        var elementName;
        if(inputs[i].id == 'searchPattern') {
            elementName = 'ingredient';
        }
        else {
            elementName = inputs[i].id;
        }
        $('#' + divId)
            .append(
                $('<div/>', {
                    'class': 'ui-block-' + uigrid[i]
                }).append(
                    $('<input/>', {
                        'type': 'text',
                        'name': elementName,
                        'value': inputs[i].value,
                        'class': inputs[i].id,
                        'readonly': 'true'
                    }).text(inputs[i].value)
                )
            ).trigger('create');
    }
    $('#' + divId)
        .append(
            $('<div/>', {
                'class': 'ui-block-d'
            }).append(
                $('<a/>', {
                    'href': '#',
                    'data-role': 'button',
                    'class': 'ingredientDelete',
                    'data-icon': 'delete',
                    'data-iconpos': 'notext'
                }).text('Delete')
            ).trigger('create')
        ).trigger('create');

    $('#delete' + index).click(function (e) {
        removeIngredient(divId);
    });
    $( "#popupIngredient" ).popup( "close" );
}

function saveRecipe(e) {
    if ($('#titel').val().length == 0) {
        $('#popupContent').empty().append('<h1>Ofullständigt recept</h1><h3 class="ui-title">Det saknas en titel!</h3><a href="#" class="ui-btn ui-corner-all ui-shadow ui-btn-inline ui-btn-b" data-rel="back">Stäng</a>');
        $('#popupInfo').popup('open');
        return;
    }
    
    $.post('/saveRecipe', $('form').serializeArray(), function (data) {
        var ru = JSON.parse(data);
        console.log('Rspons', data);
        if(ru.redirect == true) {
            window.location.replace(ru.url);
        }
        else {
            console.log('Failure');
            console.log(ru.result);
            $('#popupContent').empty().append(ru.result).append('<a href="#" class="ui-btn ui-corner-all ui-shadow ui-btn-inline ui-btn-b" data-rel="back">Stäng</a>');
            $('#popupInfo').popup('open');
            return;
        }
    });
}

function sortByIngredient(a,b) {
  if (a.ingredient < b.ingredient)
    return -1;
  if (a.ingredient > b.ingredient)
    return 1;
  return 0;
}
$( document ).on( "pageinit", "#newRecipe", function(event) {
    $('#popupAdd').click(addIngredient);
    $('#saveRecipe').click(saveRecipe);
    $(document).on('click', '.insertIngredient', function (e) {
        $('#searchPattern').val($(e.currentTarget).html());
        $(e.currentTarget).parent().addClass("ui-screen-hidden").siblings().addClass("ui-screen-hidden");
    });

    $(document).on('click', '.ingredientDelete', function (e) {
        $(e.currentTarget).parents('.ingredientsContainer').remove();
    });

    $('#searchPattern').keyup(function (e) {
        var pattern =  $('#searchPattern').val().split(" ");
        if(pattern.length == 0) {
            return;
        }
        $.get('/ajax/searchIngredient', {
            'searchPatterns': pattern},
              function(data) {
            var result = JSON.parse(data),
                item;
            $('#searchResult').empty();
            for(item in result.sort(sortByIngredient)) {
                $('#searchResult').append(
                    $('<li/>') .append(
                        $('<a/>', {
                            'href': '#',
                            'class': 'ui-btn ui-mini insertIngredient'
                        }).text(result[item]['ingredient'])
                    )
                ).trigger('create');
            }
        });
    });
});

/*******************************************************
* Page: admin
********************************************************/
function displayStatus(data) {
    var ul = $('<ul/>', {
        'data-role': 'listview',
        'data-count-theme': 'b'
    }),
        backupDiv,
        index,
        tmpLi,
        tmpUl,
        lStorage,
        storageDiv;
    
    $('#status').empty();
    $('#status').append(ul);

    lStorage = JSON.parse(getFromFridge());
    tmpLi = $('<li/>').append('In the local fridge').append($('<span/>', {
        'class':'ui-li-count',
    }).text(lStorage.length));
    $(ul).append(tmpLi);

    lStorage = JSON.parse(getFavourite());
    tmpLi = $('<li/>').append('In the favourite').append($('<span/>', {
        'class':'ui-li-count',
    }).text(lStorage.length));
    $(ul).append(tmpLi);

    if(isSiteOnline() == false) {
        $('#status').trigger('create');
        return;
    }
    
    $(ul).append($('<li/>').append('In the fridge').append($('<span/>', {
        'class':'ui-li-count',
    }).text(data.num_of_fridge)));

    $(ul).append($('<li/>').append('Number of recipes').append($('<span/>', {
        'class':'ui-li-count',
    }).text(data.num_of_recipes)));

    $(ul).append($('<li/>').append('Number of ingredients').append($('<span/>', {
        'class':'ui-li-count',
    }).text(data.num_of_ingredients)));

    backupDiv = $('<li/>', {
        'data-role': 'collapsible'
    }).append($('<h4/>').text('Backups').append($('<span/>', {
        'class':'ui-li-count',
    }).text(data.backups.length)));
    tmpUl = $('<ul/>', {
        'data-role': 'listview'
    });
    backupDiv.append(tmpUl);
    for(index = 0; index < data.backups.length; index += 1) {
        tmpLi = $('<li/>').append($('<a/>', {
            'class': 'ui-btn ui-btn-icon-right ui-icon-back restoreBtn show-page-loading-msg',
            'data-file': data.backups[index]
        }).text(data.backups[index]));
        tmpUl.append(tmpLi);
    }
    $(ul).append(backupDiv);
    
    $('#status').trigger('create');
}

$( document ).on( "pageinit", "#adminPage", function(event) {
    $(document).on('click', '.restoreBtn', function (e) {
        $.post('/admin/restore', {version: $(e.currentTarget).data('file')}, function (data) {
            displayStatus(JSON.parse(data));
            $.get('/admin/status', function (data) {
                displayStatus(JSON.parse(data));
            });
        });
    });

    if( isSiteOnline() == true) {
        $.get('/admin/status', function (data) {
            displayStatus(JSON.parse(data));
        });
    }
    else {
        displayStatus(JSON.parse(null));
    }
    
    $('#backupdb').click(function (e) {
        $.get('/admin/backup', function (data) {
            displayStatus(JSON.parse(data));
        })
    });
});

/*******************************************************
* Page: search
********************************************************/
$( document ).on( "pageinit", "#search", function(event) {
    $('#searchPattern').keyup(function (e) {
        var pattern =  $('#searchPattern').val().split(" ");
        if(pattern.length == 0) {
            return;
        }
        $.get('/ajax/search', {
            'searchPatterns': pattern},
              function(data) {
            var result = JSON.parse(data),
                item;
            console.log(data);
            $('#searchResult').empty();
            for(item in result.sort(sortByTitle)) {
                $('#searchResult').append(
                    $('<li/>') .append(
                        $('<a/>', {
                            'href': '/show/recipe?recipe='+result[item]['key'],
                        }).text(result[item]['title'])
                    )
                ).listview('refresh');
            }
        });
    });
});

/*******************************************************
* Page: groceryList
********************************************************/
function SelectText(element) {
    var doc = document,
        text = doc.getElementById(element),
        range,
        selection;    
    if (doc.body.createTextRange) {
        range = document.body.createTextRange();
        range.moveToElementText(text);
        range.select();
    } else if (window.getSelection) {
        selection = window.getSelection();        
        range = document.createRange();
        range.selectNodeContents(text);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}


$( document ).on( "pageinit", "#groceryList", function(event) {     
    $('.all-ingredients-button').click(function (e) {
        var parent = $(this).parents('.recipe');
        parent.find('.ingredientsCheckbox').prop('checked', true).checkboxradio('refresh');
        e.preventDefault();
    });

    $('.no-ingredients-button').click(function (e) {
        var parent = $(this).parents('.recipe');
        parent.find('.ingredientsCheckbox').prop('checked', false).checkboxradio('refresh');
        e.preventDefault();
    });
    
    $('#sendGroceryList').click(function (e) {
        var checkedItems = $('.ingredientsCheckbox:checked').siblings('label');
        $('#readyList').empty();
        for(var index = 0; index < checkedItems.length; index++) {
            var text = $(checkedItems[index]).children('.amountValue').html()+' '+$(checkedItems[index]).children('.measurementValue').html()+' '+$(checkedItems[index]).children('.ingredientValue').html();
            $('#readyList').append(text+'\n');
        }
        var message = encodeURIComponent($('#readyList').html());
        $('#sendSms').data('href','sms:?body='+message);
        $('#sendMail').data('href','mailto:?body='+message);
    });
    
    $('#selectListButton').click(function(e){
        SelectText('readyList');
    });
    
    $(document).on('change', '.portionsSlider', function (e) {
        var amountValues = $(e.currentTarget).parents('.recipe').find('.amountValue'),
            newPortions = parseInt(e.currentTarget.value),
            n,
            tmpValue,
            oneValue,
            newValue,
            previousPortions = $(e.currentTarget).data('oldportions');
        for(n = 0; n < amountValues.length; n += 1) {
            tmpValue = parseFloat(amountValues[n].innerHTML);
            oneValue = tmpValue/previousPortions;
            newValue = oneValue*newPortions;
            amountValues[n].innerHTML = newValue;
        }
        $(e.currentTarget).data('oldportions', newPortions);
    });
});

/*******************************************************
* Page: favouritePage
********************************************************/
function displayFavRecipes() {
    var jsonData = getFavourite(),
        item,
        recipes,
        recipeIndex;
    if(jsonData == null) {
        return;
    }
    recipes = JSON.parse(jsonData);
    $('#favouriteRecipes').empty();
    for(recipeIndex in recipes.sort(sortByTitle)) {                
        var recipe = recipes[recipeIndex],
            divCollapsible = $('<div/>', {
                'data-role': 'collapsible'
            }),
            headerTitle = $('<h4/>').text(recipe['title']),
            divPortions = $('<div class="ui-grid-b"/>').append($('<h4 class="ui-block-a">Portioner</h4>')),
            selectElem = $('<select class="ui-block-b myportions" id="portions" data-mini="true" data-inline="true"/>'),
            divIngredients = $('<div class="ingredients"/>'),
            ulIngredients = $('<ul/>');
        
        for(var j=1; j < 25; j++) {
            var selected = recipe['portions'] == j ? 'selected': '';
            selectElem.append($('<option values="'+j+'" '+selected+'>'+j+'</option>'));
        }
        divPortions.append(selectElem);
        
        divIngredients.append(ulIngredients);
        for(var ingr=0; ingr < recipe['ingredients'].length; ingr++) {
            var ingredient = recipe['ingredients'][ingr];
            ulIngredients.append($('<li><span class="amountValue">'+ingredient['amount']+'</span> '+ingredient['measurement']+' '+ingredient['ingredient']+'</li>'));
        }
        var preInstructions = $('<div/>', {
            'class':'instructions'
        }).text(recipe['instructions']);
        divCollapsible.append(headerTitle)
            .append(divPortions)
            .append(divIngredients)
            .append(preInstructions);
        $('#favouriteRecipes').append(divCollapsible).trigger('create');
    }
}

$( document ).on( "pageinit", "#favouritePage", function(event) {
    $(document).on('click', '.deleteFavourite', function (e) {
        $(e.currentTarget).parents('.collapsible').remove();
    });
    $('#addFavouritsPanel').on('panelbeforeopen', function (e) {
        if(isSiteOnline() == false) {
            return;
        }
        
       $.get('/ajax/getRecipesJson', function (data) {
           var recipes = JSON.parse(data),
               selectList = $('#addFavouritsPanel').find('fieldset'),
               item;
           selectList.empty();
           for(item in recipes.sort(sortByTitle)) {
               selectList.append($('<input/>', {
                   'type': 'checkbox',
                   'value': recipes[item]['key'],
                   'id': 'recipe_'+recipes[item]['key'],
               }));
               selectList.append($('<label/>', {
                   'for': 'recipe_'+recipes[item]['key']
               }).text(recipes[item]['title']));
           }
           var jsonData = getFavourite();
           var storedRecipes = JSON.parse(jsonData);
           for(var i in storedRecipes) {
               var tmpRecipe = storedRecipes[i];
               var tmpInput = $('input[value="'+tmpRecipe['key']+'"]').prop('checked', true);
           }

           selectList.trigger('create');
       }); 
    });
    
    $('#addFavouritsPanel').on('panelbeforeclose', function (e) {
        var recipeKeys = $('#addFavouritsPanel').find('input:checked'),
            recipeKeysJson = [];
        if(recipeKeys.length == 0 && isSiteOnline() == true) {
            setFavourite('[]');
            displayFavRecipes();
            return;
        }
        
        for(var i=0; i < recipeKeys.length; i++) {
            recipeKeysJson.push({'recipeKey':recipeKeys[i].value})
        }

        if(isSiteOnline() == true) {
            $.post('/ajax/getRecipesJson', {'recipe':JSON.stringify(recipeKeysJson)}, function (data) {
                setFavourite(data);
                displayFavRecipes();
            });
        }
        else {
            displayFavRecipes();
        }

    });
    
    $(document).on('focus', '.myportions', function (e) {
        $(e.currentTarget).data('data-oldportions', e.currentTarget.value);
    });
    $(document).on('change', '.myportions', function (e) {
        var amountValues = $(e.currentTarget).parents('.ui-collapsible').find('.amountValue'),
            newPortions = parseInt(e.currentTarget.value),
            n,
            tmpValue,
            oneValue,
            newValue,
            previousPortions = $(e.currentTarget).data('data-oldportions');
        for(n = 0; n < amountValues.length; n += 1) {
            tmpValue = parseFloat(amountValues[n].innerHTML);
            oneValue = tmpValue/previousPortions;
            newValue = oneValue*newPortions;
            amountValues[n].innerHTML = newValue;
        }
    });
            
    displayFavRecipes();
});

$(document).on('pageinit', function (e) {
    if(isSiteOnline() == false) {
        $('.onlineonly').hide();
    }
    window.addEventListener("offline", function(e) {
        $('.onlineonly').hide();
    });

    window.addEventListener("online", function(e) {
        $('.onlineonly').show();
    });
});
