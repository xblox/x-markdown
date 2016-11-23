/** @module xide/views/MarkdownBrowser **/
define([
    "xdojo/declare",
    "dcl/dcl",
    'xide/utils',
    "xide/lodash",
    "xide/widgets/TemplatedWidgetBase",
    'xdojo/has!xace?xace/views/Editor',
    'xfile/views/FileGrid',
    'xdojo/has',
    'xide/$'

], function (declare, dcl, utils, _, TemplatedWidgetBase, Editor, FileGrid, has,$) {
    var showDown = typeof showdown != 'undefined' ? showdown : null;
    var hljs = typeof hljs != 'undefined' ? hljs : null;
    //images
    var INLINE_IMAGES_EXPRESSION = /!\[(.*?)]\s?\([ \t]*()<?(\S+?)>?(?: =([*\d]+[A-Za-z%]{0,4})x([*\d]+[A-Za-z%]{0,4}))?[ \t]*(?:(['"])(.*?)\6[ \t]*)?\)/g;
    var REFERENCE_IMAGE_EXPRESSION = /!\[([^\]]*?)] ?(?:\n *)?\[(.*?)]()()()()()/g;

    //links
    var LINKS_EXPRESSION = /href="([^\'\"]+)/g;

    var displayEditButton = has('admin') ? 'block' : 'none';

    //template for preview panel
    var MarkdownView = dcl(TemplatedWidgetBase, {
        templateString: "<div class='widget container MarkdownView'>" +
        '<nav style="height:auto;min-height:auto;display:'+displayEditButton +';" class="navbar navbar-static-top"><button attachTo="editButton" class="btn btn-default" style="float:right"><li class="fa fa-edit"></li> Edit</button></nav>'+
        "<div class='Page' attachTo='markdown'/>" +
        "</div>"
    });

    function joinUrl(fileItem,url){
        return utils.pathinfo(fileItem.path).dirname.split('/').concat(url.split('/')).join('/')
    }
    /**
     *
     * Markdown browser with preview and editor. This class extends the standard file grid.
     *
     * - Renders selected files in the grid's right panel with the 'showdown' markdown HTML converter
     * - If editor option is enabled, it also renders an editor in the grid's right bottom panel.
     * - This works pretty fast. The editor and the showdown instance is cached and only updates the content when another
     *   file has been selected. Rendering lodash's main doc page last around 1 second.
     *
     * @class module:xide/views/MarkdownBrowserFileGrid
     * @extends module/views/FileGrid
     *
     * @example

     var markdownBrowser = utils.addWidget(MarkdownFileGrid,null,{
             ctx:xide_context,
             collection:fileStore
             startFile:'./_index.md',
             editor:true
         },container,true);
     */
    var MarkdownFileGrid = declare("FileGrid", FileGrid, {
        showdownExtensions:[],
        getEditorTarget:function(){

        },
        /**
         * The first item to auto select
         * @type {string|int|null}
         */
        startFile: null,
        /**
         * The showdown converter instance
         */
        converter: null,
        /**
         * Handle links will set all A elements href attribute to "javascript:void(0)" and routes the click
         * to this.onLink which routes further to this.onExternalLink or this.onRelativeLink
         * @type {boolean}
         */
        handleLinks:true,
        /**
         * Highlight code in markdown preview if hljs is available
         * @type {boolean}
         */
        hightlightCode:true,
        /**
         * The instance of our MarkdownView preview
         */
        preview: null,
        /**
         * Optional editor class, defaults to xace/ACEEditor if 'xace' build flag is enabled
         * @type {module:xide/editor/Base}
         */
        EDITOR_CLASS: null,
        /**
         * Optional, pass another widget class to render showdown's HTML converter result
         * @type {module:xide/widgets/_Widget}
         */
        PREVIEW_CLASS:null,
        /**
         * The ACE editor instance, set this to false to prevent it
         * @type {module:xace/views/ACEEditor|boolean}
         */
        editor: null,
        /**
         * Current rendered file item
         * @type {module:xfile/model/File}
         */
        fileItem: null,
        /**
         * Hide default columns
         */
        _columns: {
            "Type": false,
            "Path": false,
            "Size": false,
            "Modified": false,
            "Owner": false,
            "Media": false
        },
        /**
         * Set column formatter for 'Name' in order to remove file extension
         */
        formatters: {
            'Name': function (field, value, obj) {
                var parts = value.split('_');
                //strip "01_" from path
                value = parts.length ? parts[parts.length - 1] : value;
                //string file extension
                value = utils.basename(value, '.md');
                value = utils.basename(value, '.MD');
                return this.formatColumn(field, value, obj);
            }
        },
        /**
         * Register 'showdown' extensions to fix links and images since we're rendering markdown files from a VFS.
         * @param showdown
         * @param owner
         */
        registerShowDown: function (showdown, owner) {
            showdown.extension('xcf', function () {
                return [
                    ///////////////////////////////////////////////////////////////
                    //
                    //      After parsed by showdown
                    //
                    /*
                     {
                     type: 'output',
                     filter: function (text) {
                     //var expression = /[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+.~#?&//=]*)?/gi;
                     text = text.replace(LINKS_EXPRESSION, function (match, url, rest) {
                     //return "href=" + (owner._emit('afterParsedLink',{match:match,url:url}) || text);
                     return url;
                     });
                     return text;
                     }
                     },
                     */
                    ///////////////////////////////////////////////////////////////
                    //
                    //      Before parsed: fix image links
                    //
                    {
                        type: 'lang', //or output
                        filter: function (text/*, converter, options*/) {
                            function writeImageTag(wholeMatch, altText, linkId, url, width, height, m5, title) {
                                var gUrls = [],
                                    gTitles = [],
                                    gDims = [];

                                linkId = linkId.toLowerCase();

                                if (!title) {
                                    title = '';
                                }
                                if (url === '' || url === null) {
                                    if (linkId === '' || linkId === null) {
                                        // lower-case and turn embedded newlines into spaces
                                        linkId = altText.toLowerCase().replace(/ ?\n/g, ' ');
                                    }
                                    url = '#' + linkId;

                                    if (!showdown.helper.isUndefined(gUrls[linkId])) {
                                        url = gUrls[linkId];
                                        if (!showdown.helper.isUndefined(gTitles[linkId])) {
                                            title = gTitles[linkId];
                                        }
                                        if (!showdown.helper.isUndefined(gDims[linkId])) {
                                            width = gDims[linkId].width;
                                            height = gDims[linkId].height;
                                        }
                                    } else {
                                        return wholeMatch;
                                    }
                                }

                                altText = altText.replace(/"/g, '&quot;');
                                altText = showdown.helper.escapeCharacters(altText, '*_', false);
                                url = showdown.helper.escapeCharacters(url, '*_', false);
                                url = owner.resolveImage(null, url, owner.fileItem);
                                var result = '<img src="' + url + '" alt="' + altText + '"';

                                if (title) {
                                    title = title.replace(/"/g, '&quot;');
                                    title = showdown.helper.escapeCharacters(title, '*_', false);
                                    result += ' title="' + title + '"';
                                }

                                if (width && height) {
                                    width = (width === '*') ? 'auto' : width;
                                    height = (height === '*') ? 'auto' : height;

                                    result += ' width="' + width + '"';
                                    result += ' height="' + height + '"';
                                }

                                result += ' />';
                                return result;
                            }
                            // First, handle reference-style labeled images: ![alt text][id]
                            text = text.replace(INLINE_IMAGES_EXPRESSION, writeImageTag);
                            // Next, handle inline images:  ![alt text](url =<width>x<height> "optional title")
                            text = text.replace(REFERENCE_IMAGE_EXPRESSION, writeImageTag);
                            //text = (owner._emit('parse',text) || text);
                            return text;
                        }
                    }
                ];
            });
        },
        /**
         * Resolve an image tag (after showdown parsed markdown)
         * @param match
         * @param url
         * @returns {*}
         */
        resolveImage: function (match, url) {
            if (!this.collection) {
                return url;
            }
            //internal images :
            if (url.toLowerCase().indexOf('http') == -1 && url.indexOf('https') == -1) {
                return this.ctx.getFileManager().getImageUrl({
                    mount: this.collection.mount,
                    //build the path by joining current item's path with the url
                    path: utils.pathinfo(this.fileItem.path).dirname.split('/').concat(url.split('/')).join('/')
                });
            }

            return url;
        },
        /**
         * Create ACE editor
         * @param fileItem
         * @param content
         * @param where
         * @param converter
         * @param preview
         * @returns {module:xide/editor/Base}
         */
        createMarkdownEditor: function (fileItem, content, where, converter, preview) {
            if (has('xace')) {
                var snippetManager = ace.require('ace/snippets').snippetManager;
                var EditorClass = this.EDITOR_CLASS || dcl(Editor, {
                        runAction: function (action) {
                            var editor = this.editor;
                            var selectedText = editor.session.getTextRange(editor.getSelectionRange());
                            if (action.command === 'Markdown/Bold') {
                                if (selectedText === '') {
                                    snippetManager.insertSnippet(editor, '**${1:text}**');
                                } else {
                                    snippetManager.insertSnippet(editor, '**' + selectedText + '**');
                                }
                            }
                            if (action.command === 'Markdown/Italic') {
                                if (selectedText === '') {
                                    snippetManager.insertSnippet(editor, '*${1:text}*');
                                } else {
                                    snippetManager.insertSnippet(editor, '*' + selectedText + '*');
                                }
                            }
                            if (action.command === 'Markdown/Link') {
                                if (selectedText === '') {
                                    snippetManager.insertSnippet(editor, '[${1:text}](http://$2)');
                                } else {
                                    snippetManager.insertSnippet(editor, '[' + selectedText + '](http://$1)');
                                }
                            }
                            editor.focus();
                            return this.inherited(arguments);
                        }
                    });

                dcl.chainAfter('runAction', EditorClass);
                var self = this;
                var editor = utils.addWidget(EditorClass, {
                    value: "",
                    item: fileItem,
                    options: {
                        mode: 'markdown',
                        fileName: fileItem.path
                    },
                    storeDelegate: {
                        getContent: function (onSuccess) {
                            return self.ctx.getFileManager().getContent(self.fileItem.mount, self.fileItem.path, onSuccess);
                        },
                        saveContent: function (value, onSuccess) {
                            return self.ctx.getFileManager().setContent(self.fileItem.mount, self.fileItem.path, value, onSuccess);
                        }
                    }
                }, this, where, false, null, null);

                editor._on('onAddActions', function (evt) {
                    var actions = evt.actions;
                    var mixin = {
                        addPermission: true
                    };
                    actions.push(editor.createAction({
                        label: 'Bold',
                        command: 'Markdown/Bold',
                        icon: 'fa-bold',
                        group: 'Text',
                        tab: 'Home',
                        mixin: mixin
                    }));

                    actions.push(editor.createAction({
                        label: 'Italic',
                        command: 'Markdown/Italic',
                        icon: 'fa-italic',
                        group: 'Text',
                        tab: 'Home',
                        mixin: mixin
                    }));

                    actions.push(editor.createAction({
                        label: 'Link',
                        command: 'Markdown/Link',
                        icon: 'fa-link',
                        group: 'Text',
                        tab: 'Home',
                        mixin: mixin
                    }));


                }, self);
                editor.startup();
                editor._on('change', function (val) {
                    if (self._isSettingValue) {
                        return;
                    }
                    if (val) {
                        var markdown = converter.makeHtml(val);
                        preview.$markdown.html(markdown);
                    }
                });
                where.add(editor);
                return editor;
            }
        },
        renderMarkdownContent: function (fileItem, where) {
            var ctx = this.ctx;
            var fileManager = ctx.getFileManager();
            var self = this;
            self.fileItem = fileItem;

            if (!fileItem || (!where && !self.preview) || !showDown) {
                return;
            }
            self.fileItem = fileItem;

            fileManager.getContent(fileItem.mount, fileItem.path, function (content) {
                self._lastContent = content;
                /////////////////////////////////////////////////////////////////////
                //
                //  Preview/Showdown update
                //
                var converter = self.converter;
                var markdown = converter.makeHtml(content);
                if (!self.preview) {
                    self.preview = utils.addWidget(self.PREVIEW_CLASS || MarkdownView, null, self, utils.getNode(where), true);
                    where.add(self.preview);
                    self.preview.$editButton.on('click',function(){
                        if(self.__bottom){
                            utils.destroy(self.__bottom);
                            self.__bottom = null;
                            self.editor = null;
                            return;
                        }
                        if(!self.__bottom) {
                            var bottom = self.__bottom = self.getEditorTarget() || self.getBottomPanel(false, 0.5, 'DefaultTab', null, self.__right);
                            bottom.getSplitter().pos(0.5);
                        }
                        if(!self.editor) {
                            self._isSettingValue = true;
                            self.editor = self.createMarkdownEditor(fileItem, self._lastContent, bottom, converter, self.preview);
                            self.editor.set('value', self._lastContent);
                            self._isSettingValue = false;
                        }
                    });
                }
                self.preview.$markdown.html(markdown);
                /////////////////////////////////////////////////////////////////////
                //
                //  apply code highlighting
                //
                if (hljs && self.hightlightCode) {
                    self.preview.$markdown.find('code').each(function (i, block) {
                        hljs.highlightBlock(block);
                    });
                }
                self._isSettingValue = true;
                /////////////////////////////////////////////////////////////////////
                //
                //  Create/Update ACE editor and bottom pane
                //
                if (!self.__bottom && self.editor !== false && (Editor || self.EDITOR_CLASS)) {
                    var bottom = self.__bottom = self.getBottomPanel(false, 0.5, 'DefaultTab', null, self.__right);
                    bottom.getSplitter().pos(0.5);
                    self.editor = self.createMarkdownEditor(fileItem, content, bottom, converter, self.preview);
                }
                self._isSettingValue = true;

                if(self.editor) {
                    self.editor.item = fileItem;
                    self.editor.set('value', content);
                }
                self._emit('rendered',self.preview.$markdown);
                self._isSettingValue = false;
                where && where.resize();
            });
        },
        startup: function () {
            var self = this;
            this.registerShowDown(showDown, this);
            //create showndown converter instance now because we do auto select and render an item during restart
            if (!self.converter) {
                self.converter = new showdown.Converter({
                    github_flavouring: true,
                    extensions: ['xcf']
                });
                self.converter.setOption('tables', true);
            }

            var res = this.inherited(arguments);
            var collection = this.collection;

            var right = this.__right;
            if(!right) {
                right = this.getRightPanel(null, null, 'DefaultTab', {});
                right.closeable(false);
                right.getSplitter().pos(0.3);
            }

            //  - auto render item
            //  - auto render a selected folder's _index.md, if exists
            this._on('selectionChanged', function (evt) {
                var selection = evt.selection;
                if (!selection || !selection[0]) {
                    return;
                }
                var item = selection[0];
                if (item.isDir) {
                    collection.open(item).then(function (items) {
                        //folder contains a standard _index.md, render it!
                        var _index = _.find(items, {name: '_index.md'});
                        if (_index) {
                            self.renderMarkdownContent(_index, right, items.filter(function (file) {
                                return file != _index;
                            }));
                        }
                    });
                    return;
                }
                self.renderMarkdownContent(item, right);
            });

            //hook into this.refresh and select first item
            res.then(function () {
                this.set('collection',collection.getDefaultCollection());
                this._showHeader(false);
                this.showStatusbar(false);
                //pre-select first index item;
                this.startFile && this.select([this.startFile], null, true, {
                    append: false,
                    focus: true,
                    delay: 1
                });
            }.bind(this));

            //we handle links in this._onClickLink
            this.handleLinks && this._on('rendered',function(evt){
                var links = evt.find("A");
                _.each(links,function(link){
                    var link = $(link);
                    var href = link.attr('href');
                    if(!href || href.startsWith('#')){
                        return;
                    }
                    link.data('href',href);
                    link.attr('href',"javascript:void(0)");
                    link.click(self.onLink.bind(self));
                });
            });
            return res;
        },
        _findLink:function(element){
            var url = element.data('href');
            if(url){
                return url;
            }
            return this._findLink(element.parent());
        },
        onLink:function(e){
            var link = $(e.target);
            var url = this._findLink(link);
            if (url.toLowerCase().indexOf('http') == -1 && url.indexOf('https') == -1) {
                return this.onRelativeLink(url);
            }
            return this.onExternalLink(url);
        },
        onExternalLink:function(url){
            //console.log('clicked external link: ',url);
        },
        onRelativeLink:function(url){
            var collection = this.collection;
            var self = this;
            url = joinUrl(this.fileItem,url);
            var item = collection.getItem(url,true,{
                checkErrors:true,
                displayError:false,
                onError:function(){
                    console.error('error resolving link : ' + url);
                }
            });
            if(item.then){
                item.then(function(item) {
                    if (item) {
                        self.renderMarkdownContent(item)
                    }
                })
            }else{
                self.renderMarkdownContent(item);
            }
        }
    });
    return MarkdownFileGrid;
});