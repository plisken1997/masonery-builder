(function ($, ctxt) {

    "use strict";
    
    $.fn.masoneryBuilder = function (opts) {

        var self = this,
            nbCols = 4,
            marginTop = 20,
            marginRight = 20,
            colWidth = Math.floor(self.width() / nbCols) - marginRight,
            options = $.extend({
                eventNamespace : "masonery_builder",
                debug: false,
                marginTop: marginTop,
                marginRight: marginRight,
                nbCols: nbCols,
                colWidth: colWidth,
                dragenter: function () {},
                dragleave: function () {},
                dragstop: function () {},
                dragover: function () {}
            }, opts),
            isBuilding = false;

        function logWarning(msg) {
            if (options.debug) {
                console.warn("masonery-builder: "+msg);
            }
        }

        function log(msg) {
            if (options.debug) {
                console.log("masonery-builder: "+msg);
            }
        }

        function logError(msg) {
            if (options.debug) {
                console.error("masonery-builder: "+msg);
            }
        }

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
                    dataTransfer = JSON.parse(ogEvent.dataTransfer.getData('text/json')),
                    coords = util.computeLayerPosition(ogEvent, $container);
                coords.x = coords.x - dataTransfer.layer.x;
                coords.y = coords.y - dataTransfer.layer.y;
                if(0 > coords.x) {
                    coords.x = 0;
                }
                if(0 > coords.y) {
                    coords.y = 0;
                }
                self.trigger(options.eventNamespace+'.dropTarget:process_drop', {
                    pos: coords, 
                    id: dataTransfer.id
                });
            })
            .on(options.eventNamespace+'.dropTarget:process_drop', function (event, datas) {
                placeItem(datas.pos, datas.id);
            })
            .on(options.eventNamespace+".masonery_ends", function (sender, datas) {
                var maxH = self.height();
                self.height(maxH);
            })
            .on(options.eventNamespace+".item_placed", function () {
            })
            .find('[draggable="true"]')
                .masoneryBuilderDraggable();


        function placeItem(pos, id) {
            $('#'+id)
                .stop()                
                .animate({
                    left: pos.x, 
                    top: pos.y
                },{
                    complete: function () {
                        self.trigger(options.eventNamespace+".item_placed");
                }});

                self.trigger(options.eventNamespace+".item_placed");
        }

        function build() {
            var cols = [], maxH = 0, nextH, i, j, l;
            for (i = 0; i < options.nbCols; i++) {
                cols.push([]);
            }

            self.find(".item").each(function (elt, pos) {
                i = findColumn($(this).position().left);
                if (null !== i) {
                    cols[i].push({
                        $elt : $(this),
                        x: getColumns()[i].start,
                        y: null
                    });
                }
            });

            for (i = 0; i < options.nbCols; i++) {
                cols[i] = cols[i].sort(function (a, b) {
                    return a.$elt.position().top < b.$elt.position().top ? -1 : 1;
                });
                nextH = 0;
                /*
                if (0  < i && cols[i].length > 0) {
                    nextH = computeHandlePreviousColumn(cols[i][0], nextH, cols[i-1]);
                }*/
                for (j = 0, l = cols[i].length; j < l; j++) {
                    if (0  < i) {
                        nextH = computeHandlePreviousColumn(cols[i][j], nextH, cols[i-1]);
                    }       
                    cols[i][j].y = nextH;
                    nextH += cols[i][j].$elt.height() + options.marginTop;
                }
                if (nextH > maxH) {
                    maxH = nextH;
                }
            }
            self.stop().animate({height: maxH});
            cols.forEach(function(e,i){
                e.forEach(function(item, j){
                    item.$elt.stop().animate({
                        top: item.y,
                        left: item.x,
                    }, {
                        easing: "linear"
                    });
                });
            });
        }

        function collision(left, right, targetTop) {
            if(left.x + left.$elt.width() < right.x) {
                return false;
            }
            var v = left.y + left.$elt.height(),
                minRight = targetTop,
                maxRight = targetTop + right.$elt.height();
            if (
                (left.y <= minRight && minRight < v)
                ||
                (left.y <= maxRight && maxRight < v)
                ||
                (minRight <= left.y && v < maxRight)
            ) {
                return true;
            }
            // @todo implémenter la colision
            return false;
        }

        function computeHandlePreviousColumn(elt, targetTop, previousCol) {
            for( var i = 0, l = previousCol.length; i < l; i++) {
                if (collision(previousCol[i], elt, targetTop)) {
                    targetTop = previousCol[i].y + previousCol[i].$elt.height() + options.marginTop;
                }
            }
            return targetTop;
        }

        function getColumns(x) {
            var cols = [],
                i;
            for (i = 0; i < options.nbCols; i++) {
                cols.push(getOffsetForColumn(i));
            }
            return cols;
        }

        function findColumn(x) {
            var col, i;
            for (i = 0; i < options.nbCols; i++) {
                col = getOffsetForColumn(i);
                if (col.start <= x && x <= col.end) {
                    return i;
                }
            }
            return null;
        }

        function getOffsetForColumn(pos) {
            return {
                start: (pos * (options.colWidth + options.marginRight)),
                end: ((pos+1) * (options.colWidth + options.marginRight)) - 1
            };
        }


        this.build = build;

        return this;
    }

}(jQuery, window));