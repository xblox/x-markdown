define([
    "dcl/dcl",
    "xide/model/Component"
], function (dcl,Component) {
    /**
     * @class xfile.component
     * @inheritDoc
     */
    return dcl(Component, {
        /**
         * @inheritDoc
         */
        beanType:'BTFILE',
        //////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        //  Implement base interface
        //
        //////////////////////////////////////////////////////////////////////////////////////////////////////
        getDependencies:function(){
            return [
                "xfile/types",
                "xfile/manager/FileManager",
                "xfile/manager/MountManager",
                "xfile/factory/Store",
                "xfile/views/FileGrid",
                "x-markdown/views/MarkdownGrid"
            ];
        },
        /**
         * @inheritDoc
         */
        getLabel: function () {
            return 'x-markdown';
        },
        /**
         * @inheritDoc
         */
        getBeanType:function(){
            return this.beanType;
        }
    });
});

