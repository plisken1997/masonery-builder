(function ($, ctxt) {

    "use strict";
    
    $.fn.masoneryBuilder = function (opts) {
     
        var options = $.extend({
                eventNamespace : "masonery_builder",
                dragenter: function () {},
                dragleave: function () {},
                dragstop: function () {},
                dragover: function () {}
            }, opts),
            self = this,
            isBuilding = false;

        function triggerEvent(eventName, datas) {
            var d = datas || {};
            self.trigger(options.eventNamespace + '.' + eventName, {
                target: self,
                datas: d
            });
        }

        $(this)
            .on('dragenter', function () {
                triggerEvent("dropTarget:dragenter", arguments);
                options.dragenter(event, this, self);
            })
            .on('dragleave', function () {
                triggerEvent("dropTarget:dragleave", arguments);
                options.dragleave(event, this, self);
            })
            .on('dragstop', function (event) {
                triggerEvent("dropTarget:dragstop", arguments);
                options.dragstop(event, this, self);
            })
            .on('dragover', function (event) {
                triggerEvent("dropTarget:dragover", arguments);
                options.dragover(event, this, self);
                event.preventDefault();
            })
            .on('drop', function (event) {
                var util = {
                    computeLayerPosition: function(event, container) {
                        var $elt = $(event.target);
                        if ($elt.hasClass("gallery")) {
                            return {
                                x: event.layerX,
                                y: event.layerY
                            }
                        } else if (!$elt.hasClass("item")) {
                            $elt = $elt.parent(".item");
                        }
                            
                        return {
                            x: $elt.position().left + event.layerX,
                            y: $elt.position().top + event.layerY
                        }
                    },

                    findContainer: function(container) {
                        if($(container).hasClass("gallery")) {
                            return $(container);
                        }
                        return $(container).parent(".gallery");
                    }
                };

                triggerEvent("dropTarget:drop", arguments);
                var $container = util.findContainer(event.delegateTarget),
                    ogEvent = event.originalEvent,
                    coords = util.computeLayerPosition(ogEvent, $container);

                self.trigger(options.eventNamespace+'.dropTarget:process_drop', {
                    pos: coords, 
                    id: JSON.parse(ogEvent.dataTransfer.getData('text/json')).id
                });
            })
            .on(options.eventNamespace+'.dropTarget:process_drop', function (event, datas) {
                reInitList(datas.pos, datas.id);
            })
            .on(options.eventNamespace+".masonery_ends", function (sender, datas) {
                var updatedMatrice = ctxt.createMatrice($('.item')).list,
                    maxH = 0, h;
                for(var i = 0, l = updatedMatrice.length; i < l; i++) {
                    h = updatedMatrice[i].getHeight();
                    maxH = h  < maxH ? maxH : h;
                }
                self.height(maxH);            
            })
            .find('[draggable="true"]')
                .masoneryBuilderDraggable();


        function reInitList(coords, id) {
            if (isBuilding) {
                return;
            }
            isBuilding = true;

            var matrice = ctxt.createMatrice(self.find('.item')),
                $elt = $('#'+id),
                col = matrice.getColumnAt(coords.x),
                marginTop = 20,
                oldCoords = {x : $elt.position().left, y: $elt.position().top},
                oldCol = matrice.getColumnAt(oldCoords.x);

            triggerEvent("masonery_begin", {target : $elt, from: oldCoords, to: coords});

            if(!col) {
                // pas d'élément dataTransfers l'emplacement visé
                eltLeft = matrice.computeX(coords.x);
                $elt.stop().animate({"top" : 0, "left": eltLeft});
            } else if (null != col && null != oldCol && col === oldCol){
                // on est dans la même colonne que la colonne de départ
                // 1. l'item est placé avant sa position courante
                if (coords.y < oldCoords.y) {
                    updateColumn($elt, col, coords, marginTop);
                } else {
                // 2. l'item est placé après sa position courante

                    var elts = col.getElementsAfter($elt.position().top),
                        eltLeft = col.min,
                        eltTop, nextTop;

                    if(0 < elts.length) {
                        // on a relaché sur l'élément courant, on ne fait rien
                        if (elts[0].containsY(coords.y)) {
                            return;
                        }
                        nextTop = elts[0].$elt.position().top;
                        var inserted = false;

                        for (var i = 1, l = elts.length; i < l; i++) {
                            // on est sur l'élément sur lequel on insère le nouvel item
                            if (elts[i].containsY(coords.y)) {
                                inserted = true;
                                if (1 === i) {
                                    $elt.stop().animate({
                                        "top" : elts[i].$elt.height() + marginTop
                                    });
                                    elts[i].$elt.stop().animate({
                                            "top" : nextTop+"px"
                                        });
                                    break;
                                } else {
                                    $elt.stop().animate({
                                        "top" : nextTop
                                    });
                                    nextTop += $elt.height() + marginTop;
                                    elts[i].$elt.stop().animate({
                                            "top" : nextTop+"px"
                                        });
                                    nextTop += elts[i].$elt.height() + marginTop;
                                }
                            } else {
                                elts[i].$elt.stop().animate({
                                        "top" : nextTop+"px"
                                    });
                                nextTop += elts[i].$elt.height() + marginTop;
                            }
                        }
                        if (!inserted) {
                            
                            $elt.stop().animate({
                                "top" : elts[elts.length-1].$elt.height() + marginTop
                            });

                        }
                    } else {
                      return;
                    }
                }
            } else {
                // on est dans une colonne différente de la colonne de départ
                // maj des nouveaux
                updateColumn($elt, col, coords, marginTop);
            }

            // maj de l'ancienne colonne
            if(oldCol && (!col || (oldCol != col))) {
               updateTargetPreviousColumn($elt, oldCol, oldCoords, marginTop);
            }

            // @todo gérer les animates pour ne pas avoir à gérer en settimeout
setTimeout(function(){
    isBuilding = false;
    triggerEvent("masonery_ends", {
        target : $elt, 
        from: oldCoords, 
        to: coords
    });
}, 750);
            return this;
        }

        function updateColumn($elt, col, coords, marginTop) {
            var elts = col.getElementsAfter(coords.y).filter(function (e) {
                    return e.$elt.attr("id") !== $elt.attr("id");
                }),
                eltLeft = col.min,
                eltTop, nextTop;

            if(0 < elts.length) {
                eltTop = elts[0].$elt.position().top;
                $elt.stop().animate({"top" : eltTop, "left": eltLeft}); 
                nextTop = $elt.height() + marginTop + eltTop;

                for(var i = 0, l = elts.length; i < l; i++) {
                    if (elts[i].$elt.attr("id")===$elt.attr("id")) {
                        continue;
                    }
                    elts[i].$elt.stop().animate({
                            "top" : nextTop+"px"
                        });
                    nextTop += elts[i].$elt.height() + marginTop;
                }
            } else {
                if(0 === col.elements.length) {
                    eltTop = 0;
                } else {
                // dernier élément, on l'ajoute à la fin de la liste
                    var $lastElt = col.elements[col.elements.length-1].$elt;
                    eltTop = $lastElt.position().top + marginTop + $lastElt.height();
                }
                $elt.stop().animate({"top" : eltTop, "left": eltLeft});
            }
        }

        function updateTargetPreviousColumn($elt, oldCol, oldCoords, marginTop) {
            var oldElts = oldCol.getElementsAfter(oldCoords.y).filter(function (e) {
                return e.$elt.attr("id") !== $elt.attr("id");
            }),
            diff;

            if(0 < oldElts.length) {
                diff = oldCoords.y;
                for(var i = 0, l = oldElts.length; i < l; i++) {
                    oldElts[i].$elt.stop().animate({
                            "top" : diff+"px"
                        });
                    diff += oldElts[i].$elt.height() + marginTop;
                }
            }
        }

        return this;
    };


    (function($, ctxt){

        /*******************************
        ***      MatriceElement      ***
        *******************************/

        function MatriceElement(x, y, $elt, staticBlock) {
            this.x = x;
            this.y = y;
            this.maxY = y + $elt.height();
            this.maxX = x + $elt.width();
            this.$elt = $elt;
            this.staticBlock = staticBlock;
            this.size = 1;
        }

        MatriceElement.prototype = {

            containsY: function (y) {
                return this.y <= y && this.maxY >= y;
            },

            getHeight: function () {
                return this.$elt.height();
            }

        };

        /********************************
        ***      MatriceItemList      ***
        ********************************/

        function MatriceItemList(min, max, marginTop) {
            this.min = min;
            this.max = max;
            this.elements = [];
            this.marginTop = marginTop;
        }

        MatriceItemList.prototype = {

            containsX: function (x) {
                return this.min <= x && x <= this.max; 
            },

            insertAt: function ($elt, posY) {
                var elt = new MatriceElement($elt.position().left, posY, $elt, false);
                if (0 === this.elements.length) {
                    this.elements.push(elt);
                } else {
                    for (var i = 0, l = this.elements.length; i < l; i++) {
                        if(posY < this.elements[i].y) {
                            this.elements.splice(i, 0, elt);
                            return this;
                        }
                    }
                    this.elements.push(elt);
                }
                return this;
            },

            getElementsAfter: function (posY) {
                var elts = [];
                for (var i = 0, l = this.elements.length; i < l; i++) {
                    if(posY < this.elements[i].maxY) {
                        elts.push(this.elements[i]);
                    }
                }
                return elts;
            },

            getHeight: function () {
                var marginTop = this.marginTop;
                if (1 === this.elements.length) {
                    return this.elements[0].getHeight() + marginTop;
                }
                return this.elements.reduce(function (previous, current, i) {
                    var v = (1 === i) ? (previous.getHeight() + marginTop) : previous;
                    return v + current.getHeight() + marginTop;
                });
            }

        };


        /************************
        ***      Matrice      ***
        ************************/

        function Matrice($list) {
            this.list = [];
            this.createFromList($list);
        }

        Matrice.prototype = {

            COL_WIDTH: 190,

            MARGIN_RIGHT: 20,

            MARGIN_TOP: 20,

            createFromList: function ($list) {
                var self = this;
                $list.each(function () {
                    var itemList = self.getColumnAt($(this).position().left);
                    if (!itemList) {
                        itemList = self.createList($(this));
                    }
                    itemList.insertAt($(this), $(this).position().top);
                });
                return this;
            },

            getColumnAt: function (pos) {
                for (var i = 0, l = this.list.length; i < l; i++) {
                    if(this.list[i].containsX(pos)) {
                        return this.list[i];
                    }
                }
                return null;
            },

            createList: function ($elt) {
                var m = new MatriceItemList($elt.position().left, $elt.position().left + this.COL_WIDTH + this.MARGIN_RIGHT-1, this.MARGIN_TOP);
                this.list.push(m);
                return m;
            },

            computeX : function (x) {
                var coeff = Math.floor(x / (this.COL_WIDTH + this.MARGIN_RIGHT));
                return coeff * (this.COL_WIDTH + this.MARGIN_RIGHT);
            }

        };

        ctxt.createMatrice = function ($list) {
            return new Matrice($list);
        };

    }($, window));

} (jQuery, window));