(function ($, ctxt) {

    "use strict";

    var DI = {};

    (function ($, DI) {

        function logWarning(msg, options) {
            if (options.debug) {
                console.warn("masonery-builder: "+msg);
            }
        }

        function log(msg, options) {
            if (options.debug) {
                console.log("masonery-builder: "+msg);
            }
        }

        function logError(msg, options, datas) {
            if (options.debug) {
                console.error("masonery-builder: "+msg, datas);
            }
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
            return false;
        }

        function computeHandlePreviousColumn(elt, targetTop, previousCol, options) {
            for( var i = 0, l = previousCol.length; i < l; i++) {
                if (collision(previousCol[i], elt, targetTop)) {
                    targetTop = previousCol[i].y + previousCol[i].$elt.height() + options.marginTop;
                }
            }
            return targetTop;
        }

        function getColumns(options) {
            var cols = [],
                i;
            for (i = 0; i < options.nbCols; i++) {
                cols.push(getOffsetForColumn(i, options));
            }
            return cols;
        }

        function findColumn(x, options) {
            var col, i;
            for (i = 0; i < options.nbCols; i++) {
                col = getOffsetForColumn(i, options);
                if (col.start <= x && x <= col.end) {
                    return i;
                }
            }
            return null;
        }

        function getOffsetForColumn(pos, options) {
            return {
                start: (pos * (options.colWidth + options.marginRight)),
                end: ((pos+1) * (options.colWidth + options.marginRight)) - 1
            };
        }


        function MasoneryBuilder($elt, options) {
            this.$elt = $elt;
            this.options = options;
            this.isBuilding = false;
        }

        MasoneryBuilder.prototype = {

            placeItem: function (pos, id) {
                var $elt = this.$elt,
                    options = this.options;
                $('#'+id)
                    .stop()
                    .animate({
                        left: pos.x,
                        top: pos.y
                    },{
                        complete: function () {
                            $elt.trigger(options.eventNamespace+".item_placed");
                    }});
                return this;
            },

            build: function () {
                if (this.isBuilding) {
                    logWarning("currently building", this.options);
                    return this;
                }
                var cols = [],
                    maxH = 0,
                    added = [],
                    self = this,
                    nextH, i, j, l;
                this.isBuilding = true;
                for (i = 0; i < this.options.nbCols; i++) {
                    cols.push([]);
                }

                this.$elt.find(this.options.itemSelector).each(function (elt, pos) {
                    i = findColumn($(this).position().left, self.options);
                    if (null !== i) {
                        cols[i].push({
                            $elt : $(this),
                            x: getColumns(self.options)[i].start,
                            y: null
                        });
                    }
                });

                for (i = 0; i < this.options.nbCols; i++) {
                    cols[i] = cols[i].sort(function (a, b) {
                        return a.$elt.position().top < b.$elt.position().top ? -1 : 1;
                    });
                    nextH = 0;
                    for (j = 0, l = cols[i].length; j < l; j++) {
                        if (0  < i) {
                            nextH = computeHandlePreviousColumn(cols[i][j], nextH, cols[i-1], this.options);
                        }
                        cols[i][j].y = nextH;
                        nextH += cols[i][j].$elt.height() + self.options.marginTop;
                    }
                    if (nextH > maxH) {
                        maxH = nextH;
                    }
                }
                this.$elt.stop().animate({height: maxH});
                cols.forEach(function(e,i){
                    e.forEach(function(item, j){
                        added.push(1);
                        item.$elt.stop().animate({
                            top: item.y,
                            left: item.x,
                        }, {
                            easing: "linear",
                            complete: function () {
                                added.pop();
                                if (0 === added.length) {
                                    self.triggerEvent("masonery_ends");
                                }
                            }
                        });
                    });
                });
            },

            triggerEvent: function (eventName, datas) {
                var d = datas || {};
                this.$elt.trigger(this.options.eventNamespace + '.' + eventName, {
                    target: self,
                    datas: d
                });
            }
        };// end prototype

        DI.createMasoneryBuilder = function ($elt, opts) {
            return new MasoneryBuilder($elt, opts);
        };

    }($, DI));


    $.fn.masoneryBuilder = function (opts) {

        var nbCols = 4,
            marginTop = 20,
            marginRight = 20,
            containerClass = "masonery",
            itemClass = "item",
            options = $.extend({
                eventNamespace : "masonery_builder",
                debug: false,
                marginTop: marginTop,
                marginRight: marginRight,
                nbCols: nbCols,
                containerSelector: "." + containerClass,
                itemSelector: "." + itemClass,
                dragenter: function () {},
                dragleave: function () {},
                dragstop: function () {},
                dragover: function () {}
            }, opts),
            isBuilding = false;


        $(this).each(function (elt, pos) {

            var self = $(this),
                opts = $.extend(options, {
                    colWidth: Math.floor($(this).width() / nbCols) - marginRight,
                }),
                builder = DI.createMasoneryBuilder($(this), opts);

            $(this)
                .on('dragenter', function (event) {
                    builder.triggerEvent("dropTarget:dragenter", arguments);
                    opts.dragenter(event, this, self);
                })
                .on('dragleave', function (event) {
                    builder.triggerEvent("dropTarget:dragleave", arguments);
                    opts.dragleave(event, this, self);
                })
                .on('dragstop', function (event) {
                    builder.triggerEvent("dropTarget:dragstop", arguments);
                    opts.dragstop(event, this, self);
                })
                .on('dragover', function (event) {
                    builder.triggerEvent("dropTarget:dragover", arguments);
                    opts.dragover(event, this, self);
                    event.preventDefault();
                })
                .on('drop', function (event) {
                    var util = {
                        computeLayerPosition: function(event, container) {
                            var $elt = $(event.target);
                            if ($elt.hasClass(containerClass)) {
                                return {
                                    x: event.layerX,
                                    y: event.layerY
                                }
                            } else if (!$elt.hasClass(itemClass)) {
                                $elt = $elt.parent(opts.itemSelector);
                            } else {
                                logError("unable to find element from ", opts, $elt);
                                return {};
                            }

                            return {
                                x: $elt.position().left + event.layerX,
                                y: $elt.position().top + event.layerY
                            }
                        },

                        findContainer: function(container) {
                            if($(container).hasClass(containerClass)) {
                                return $(container);
                            }
                            return $(container).parent(options.containerSelector);
                        }
                    };

                    builder.triggerEvent("dropTarget:drop", arguments);
                    var $container = util.findContainer(event.delegateTarget),
                        ogEvent = event.originalEvent,
                        dataTransfer = JSON.parse(ogEvent.dataTransfer.getData('text/json')),
                        coords = util.computeLayerPosition(ogEvent, $container);
                    if (!coords) {
                        logError("could not compute layer position", opts);
                        return;
                    }
                    coords.x = coords.x - dataTransfer.layer.x;
                    coords.y = coords.y - dataTransfer.layer.y;
                    if(0 > coords.x) {
                        coords.x = 0;
                    }
                    if(0 > coords.y) {
                        coords.y = 0;
                    }
                    self.trigger(opts.eventNamespace+'.dropTarget:process_drop', {
                        pos: coords,
                        id: dataTransfer.id
                    });
                })
                .on(opts.eventNamespace+'.dropTarget:process_drop', function (event, datas) {
                    builder.placeItem(datas.pos, datas.id);
                })
                .on(opts.eventNamespace+".masonery_ends", function (sender, datas) {
                    builder.isBuilding = false;
                })
                .on(opts.eventNamespace+".item_placed", function () {
                })
                .find('[draggable="true"]')
                    .masoneryBuilderDraggable();

            $(this).addClass("masonery-builder");
            this.doBuild = builder.build.bind(builder);
        });

        this.build = function () {
            this[0].doBuild();
        };

        return this;
    }

}(jQuery, window));