(function($, ctxt) {
    
    $.fn.masoneryBuilderDraggable = function() {

        $(this).on('dragstart', function (event) {
            event.originalEvent.dataTransfer.setData('text/plain', event.target.id);
            event.originalEvent.dataTransfer.setData('text/json', JSON.stringify({
                id: event.target.id
            }));
        });

        return this;
    }

}(jQuery, window));