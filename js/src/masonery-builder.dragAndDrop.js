(function($, ctxt) {
    
    $.fn.masoneryBuilderDraggable = function() {

        $(this).not('.masonery-builder-draggable').on('dragstart', function (event) {
            event.originalEvent.dataTransfer.setData('text/plain', event.target.id);
            event.originalEvent.dataTransfer.setData('text/json', JSON.stringify({
                id: event.target.id,
                layer: {x: event.originalEvent.layerX, y: event.originalEvent.layerY}
            }));
        }).addClass("masonery-builder-draggable");

        return this;
    }

}(jQuery, window));