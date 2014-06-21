

/*

--------------------------------------------------------------------------------------------------

Project:      -
Developer:    Greg Kappatos
Company:      Website Connect
Web:          http://websiteconnect.com.au
Date:         26 September, 2012
Notes:        See below


Notices:      This code was developed by Website Connect, and is the copyrighted work of Website Connect.
              Any unauthorised editing, copying, etc without written permission from
              Website Connect will result in legal action.
              The developer and the owner cannot be held responsible for any damage this code
              may cause.

--------------------------------------------------------------------------------------------------

*/

/*

----------------------------------------------------------------------

jQuery AJAX Image Carousel

jquery.ui.gCarousel-1.0.0.js
By Greg Kappatos
17 August, 2012
Copyright (c) 2012 Greg Kappatos
http://websiteconnect.com.au/

----------------------------------------------------------------------

Requirements:  jquery.ui.widget.js, alax-loader.gif

----------------------------------------------------------------------

Tested on the following browsers:
- Firefox 12.0
- Safari 5.1.1 (7534.51.22)
- Chrome 15.0.874.121 m
- Opera 11.10 Build 2092
- IE 7, 8 and 9

----------------------------------------------------------------------

Usage:

<link rel="stylesheet" href="css/jquery.ui.gCarousel-1.0.0.css" type="text/css" media="all" />
<script type="text/javascript" language="javascript" src="js/jquery.ui.widget.js"></script>
<script type="text/javascript" language="javascript" src="js/jquery.ui.gCarousel-1.0.0.js"></script>
<script type="text/javascript" language="javascript">

var gCarousel=null;

$(function() {

  gCarousel=$('#imageCarousel').gCarousel({
    ajaxUrl:"<?php echo $this->createUrl('carousel'); ?>",
    autoSlide:false,
    itemLimit:<?php echo Yii::app()->params['carouselImagesPerRequest']; ?>,
    layoutTemplate:'[{loading}{iteminfo}{paginationinfo}][{items}][{progressbar}][{navigation}{pagination}]',
    mouseOutVariable:"$('#progressdialog').is(':visible')==false && $('#mydialog').is(':visible')==false",
    paginationVisibleItems:<?php echo Yii::app()->params['carouselPaginationItems']; ?>,
    //slideDuration:1750,
    //slideEasing:'easeOutQuint',
    slideTimeout:<?php echo Yii::app()->params['carouselSlideTimeOut']; ?>,
    totalItems:<?php echo count(UserImage::model()->findAllByAttributes(array('approved'=>1))); ?>,
    visibleItems:<?php echo Yii::app()->params['carouselImagesVisible']; ?>,

    OnItemClick:function(item,e){openImageDialog($.parseJSON($(item).children('input').val()),function(event, ui) {if ($('#imageCarousel').gCarousel('isPlaying')){$('#imageCarousel').gCarousel('resume');});}

  });

});

</script>

<ul id="imageCarousel"></ul>


----------------------------------------------------------------------


 */

/* this is used for imageloading in the carousel */
function imageData(src){

  this.loaded=false;
  this.src=src;

}

/* this is used to load the default ajax-loading.gif image */
function getScriptFolder(){

  var scriptEls = document.getElementsByTagName( 'script' );
  var thisScriptEl = scriptEls[scriptEls.length - 1];
  var scriptPath = thisScriptEl.src;

  return scriptPath.substr(0, scriptPath.lastIndexOf( '/' )+1 );

}

if (!Array.prototype.remove){
  // Array Remove - By John Resig (MIT Licensed)
  Array.prototype.remove = function(from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
  };
}

(function($) {

  var carouselScriptFolder=getScriptFolder();

  $.widget("ui.gCarousel", {

    /* Public Properties */

    options: {
      ajaxUrl:null,
      autoSlide:false,                                        /* start sliding automatically? */
      disabledPaginationItemsVisible:false,                   /* if true, will hide first,prev,next,last pagination buttons if they are disabled*/
      itemClassName:'ui-button ui-widget ui-state-default',   /* this class will be added to the carousel items */
      itemHoverClassName:'ui-state-hover',                    /* this class will be added to the carousel items when mouse hovers over an item */
      itemLimit:1,                                            /* number of items to slide by each time */
      layoutTemplate:null,                                    /* defaults to [{iteminfo}{paginationinfo}{loading}][{items}][{progressbar}][{pagination}{navigation}]  note: items within the same row must remain within that row, eg you cant put navigation with loading */
      loadingImage:carouselScriptFolder+'ajax-loader.gif',    /* path to preloader image. other preloaders: http://preloaders.net/ http://ajaxload.info/ */
      mouseOutVariable:null,                                  /* if not null, this var will be checked to be true before resuming automatic slideshow after mouseout */
      navigationTemplate:null,                                /* defaults to {prev}{stop}{play}{next}{refresh} */
      paginationTemplate:null,                                /* defaults to {first}{prev}{items}{next}{last} */
      paginationVisibleItems:5,                               /* number of pagination items to show */
      pauseOnHover:true,                                      /* pause timer when mouse hovers over a item */
      slideDuration:1750,                                     /* time taken to slide (ms) */
      slideEasing:'easeOutQuint',                             /* other easing options: http://jqueryui.com/demos/effect/easing.html */
      slideTimeout:10000,                                     /* time between automatic slides (ms) */
      totalItems:0,                                           /* initial total - this will be checked against every ajax request, in case the total changes*/
      visibleItems:1,                                         /* number of items in the carousel at once */

      /* Public Events */

      OnItemClick:$.noop,
      OnAfterSlide:$.noop

    },

    /* Private Properties */

    _actualVisibleItems:0,                                    /* used in case number of items is lower than desired visible items */
    _actualItemLimit:0,                                       /* used in case _actualVisibleItems > itemLimit */
    _currentStart:0,                                          /* index of first item for ajax call */
    _currentEnd:0,                                            /* index of last item for ajax call */
    _currentFirst:0,                                          /* the database index of the first visible item */
    _tempIndex:-1,                                            /* index used if some items are already visible on carousel */
    _borderWidth:0,
    _itemPaddingRight:0,
    _arrImageData:[],
    _isPlaying:false,
    _totalPages:1,
    _currentPage:1,
    _pbTimerId:null,
    _pbCounter:null,
    _currentPageGroup:1,
    _isSliding:false,
    _autoReset:false,
    _hasBeenAdjusted:false,
    _currentItemsLeft:0,
    _lastDirection:'next',
    _isMouseOver:false,
    _loadingImageVisible:false,
    _progressBarVisible:false,

    /* put or dont put in any order eg: {prev}{stop}{play}{next}{refresh} -play button gets replaced with pause button */
    _defaultNavigationItems:new Array('prev','stop','play','next','refresh'),
    _defaultPaginationItems:new Array('first','prev','items','next','last'),
    _defaultLayoutItems:new Array( new Array('iteminfo','paginationinfo','loading'), new Array('items'), new Array('progressbar'), new Array('pagination','navigation') ),

    /* objects/elements */
    _element:null,
    _parentContainer:null,
    _carousel:null,
    _dialog:null,
    _loader:null,
    _pb:null,
    _paginationList:null,
    _paginationItems:null,
    _navigationList:null,
    _paginationInfo:null,
    _itemInfo:null,

    /* navigation buttons */
    _cmdPrev:null,
    _cmdNext:null,
    _cmdPlay:null,
    _cmdPause:null,
    _cmdStop:null,
    _cmdRefresh:null,

    /* pagination buttons */
    _cmdPFirst:null,
    _cmdPLast:null,
    _cmdPNext:null,
    _cmdPPrev:null,
    _cmdPItems:null,

    /* Private Functions */

		_create: function() {

      var self=this;
      self._carousel=$(this.element);
      self._element=this.element;

      self._resetCarousel();

      if (self.options.autoSlide && self.options.totalItems > self._actualVisibleItems){
        self._cmdPlay.hide();
        self._cmdPause.show();
        self._cmdStop.show();
        self._isPlaying=true;
        self.resume();
      }

      //self._trigger("onCreated", null, cap);

		},

    _isBeforeOrAfter:function(str,index,arr){

      return (this._isValueBefore(str,index,arr) || this._isValueAfter(str,index,arr));

    },

    _isValueAfter:function(str,index,arr){

      var result=false;
      var after=null;

      if (index + 1 <= arr.length-1)
        after=arr[index+1];

      if (after!=null && after==str)
        result=true;

      return result;

    },

    _isValueBefore:function(str,index,arr){

      var result=false;
      var before=null;

      if (index - 1 > -1)
        before=arr[index-1];

      if (before!=null && before==str)
        result=true;

      return result;

    },

    _buildLayout:function(){

      var self=this;

      this.destroy();

      var parent=$('<div></div>').addClass('list_carousel');

      $(self._element).wrap(parent);
      parent=$(self._element).parent();
      parent.append($('<div></div>').addClass('clearfix'));

      self._parentContainer=$('<div></div>').addClass('carouselContainer ui-widget');
      parent.wrap(self._parentContainer);
      self._parentContainer=parent.parent();

      self._loader=$('<img />');
      self._loader.attr('alt','');
      self._loader.attr('src',self.options.loadingImage);

      self._parentContainer.append($('<div></div>').addClass('clearfix'));

      var titleContainer=$('<div></div>').addClass('carouselTitleContainer');

      var title=$('<div></div>').addClass('carouselTitle');

      var itemInfo=$('<span></span>').addClass('carouselItemInfo carouselInfo');

      itemInfo.append('<strong>Items:</strong> ');
      itemInfo.append($('<span></span>').addClass('carouselFirst'));
      itemInfo.append('&nbsp;to&nbsp;');
      itemInfo.append($('<span></span>').addClass('carouselLast'));
      itemInfo.append('&nbsp;of&nbsp;');
      itemInfo.append($('<span></span>').addClass('carouselTotal'));

      var paginationInfo=$('<span></span>').addClass('carouselPaginationInfo carouselInfo');

      paginationInfo.append('<strong>Page:</strong> ');
      paginationInfo.append($('<span></span>').addClass('carouselPage'));
      paginationInfo.append('&nbsp;of&nbsp;');
      paginationInfo.append($('<span></span>').addClass('carouselPageTotal'));

      var pagerContainer=$('<div></div>').addClass('carouselPager');
      var nc=$('<div></div>').addClass('carouselNavigation');
      nc.html('<ul class="carouselNavigationList"></ul>');

      var pc=$('<div></div>').addClass('carouselPagination');
      pc.html('<ul class="carouselPaginationList"></ul>');

      /* at this point, this._parentContainer only has items + clearfix */

      var layout=this._extractLayoutTemplate();
      var hasItemInfo=false,hasPaginationInfo=false,hasLoading=false,hasItems=false,hasProgressBar=false,hasPagination=false,hasNavigation=false;//hasPager=false;

      this._loadingImageVisible=false;
      this._progressBarVisible=false;

      for (var i=0;i<layout.length;i++){

        for (j=0;j<layout[i].length;j++){

          switch(layout[i][j].toLowerCase()){

            case 'iteminfo':

              if (j==layout[i].length-1)
                itemInfo.css({marginRight:0});

              hasItemInfo=true;
              title.append(itemInfo);

              if (!this._isValueAfter('paginationinfo',j,layout[i])){
                titleContainer.append(title);
                titleContainer.append($('<div></div>').addClass('clearfix'));
              }

              if (j==layout[i].length-1){
                if (hasItems)
                  self._parentContainer.append(titleContainer);
                else
                  self._parentContainer.prepend(titleContainer);
              }

              break;

            case 'paginationinfo':

              if (j==layout[i].length-1)
                paginationInfo.css({marginRight:0});

              hasPaginationInfo=true;
              title.append(paginationInfo);

              if (!this._isValueAfter('iteminfo',j,layout[i])){
                titleContainer.append(title);
                titleContainer.append($('<div></div>').addClass('clearfix'));
              }

              if (j==layout[i].length-1){
                if (hasItems)
                  self._parentContainer.append(titleContainer);
                else
                  self._parentContainer.prepend(titleContainer);
              }

              break;

            case 'loading':

              hasLoading=true;
              this._loadingImageVisible=true;
              if (j==layout[i].length-1){
                //float right
                titleContainer.prepend($('<div></div>').addClass('carouselLoading').html(self._loader));
                if (hasItems)
                  self._parentContainer.append(titleContainer);
                else
                  self._parentContainer.prepend(titleContainer);
              } else {
                var div=$('<div></div>').addClass('carouselLoading').html(self._loader);
                title.css({float:'right'});
                titleContainer.append($('<div></div>').addClass('carouselLoading').html(self._loader).css({float:'left'}));
              }

              break;

            case 'items':

              hasItems=true;
              break;

            case 'progressbar':

              hasProgressBar=true;
              this._progressBarVisible=true;
              if (hasItems)
                self._parentContainer.append($('<div></div>').addClass('carouselProgress'));
              else
                self._parentContainer.prepend($('<div></div>').addClass('carouselProgress'));

              break;

            case 'pagination':

              hasPagination=true;
              pagerContainer.append(pc);

              if (j==layout[i].length-1){
                pc.css({float:'right'});
                nc.css({float:'left'});
                pagerContainer.append($('<div></div>').addClass('clearfix'));
                if (hasItems)
                  self._parentContainer.append(pagerContainer);
                else
                  self._parentContainer.prepend(pagerContainer);
              }

              break;

            case 'navigation':

              hasNavigation=true;
              pagerContainer.append(nc);

              if (j==layout[i].length-1){
                nc.css({float:'right'});
                pc.css({float:'left'});
                pagerContainer.append($('<div></div>').addClass('clearfix'));
                if (hasItems)
                  self._parentContainer.append(pagerContainer);
                else
                  self._parentContainer.prepend(pagerContainer);
              }

              break;

          }

        }

      }

      if (!hasItemInfo)
        self._parentContainer.append($('<div></div>').html(itemInfo).css({display:'none'}));

      if (!hasPaginationInfo)
        self._parentContainer.append($('<div></div>').html(paginationInfo).css({display:'none'}));

      if (!hasLoading)
        self._parentContainer.append($('<div></div>').addClass('carouselLoading').html(self._loader));

      //if (!hasItems)
        //items are already there

      if (!hasProgressBar)
        self._parentContainer.append($('<div></div>').addClass('carouselProgress'));

      if (!hasPagination)
        self._parentContainer.append(pc.css({display:'none'}));

      if (!hasNavigation)
        self._parentContainer.append(nc.css({display:'none'}));

      self._navigationList=self._parentContainer.find('.carouselNavigationList');
      self._paginationList=self._parentContainer.find('.carouselPaginationList');
      self._paginationInfo=self._parentContainer.find('.carouselPaginationInfo');
      self._itemInfo=self._parentContainer.find('.carouselItemInfo');

      self._pb=self._parentContainer.find('.carouselProgress');
      self._parentContainer.append($('<div></div>').addClass('carouselDialog dialog').html('<div>&nbsp;</div><p></p>'));
      self._dialog=self._parentContainer.find('.carouselDialog');
      self._dialog.dialog({
        autoOpen:false,
        modal:true
      });

    },

		_setOption: function(option, value) {
			$.Widget.prototype._setOption.apply( this, arguments );

      var needsReset=false;

      switch (option){
        case 'ajaxUrl':
          this.options.ajaxUrl=value;
          break;
        case 'autoSlide':
          this.options.autoSlide=value;
          break;
        case 'disabledPaginationItemsVisible':
          this.options.disabledPaginationItemsVisible=value;
          this._updatePagination();
          break;
        case 'itemClassName':
          this.options.itemClassName=value;
          var items=this._getItems();
          for (var i=0;i<items.length;i++)
            $(items[i]).removeClass().addClass(this.options.itemClassName);
          break;
        case 'itemHoverClassName':
          this.options.itemHoverClassName=value;
          needsReset=true;
          break;
        case 'itemLimit':
          this.options.itemLimit=value;
          needsReset=true;
          break;
        case 'visibleItems':
          this.options.visibleItems=value;
          needsReset=true;
          break;
        case 'layoutTemplate':
          this.options.layoutTemplate=value;
          needsReset=true;
          break;
        case 'loadingImage':
          this.options.loadingImage=value;
          this._loader.attr('src',this.options.loadingImage);
          break;
        case 'mouseOutVariable':
          this.options.mouseOutVariable=value;
          this._resetCarousel();
          this._setItemClick();
          break;
        case 'navigationTemplate':
          this.options.navigationTemplate=value;
          needsReset=true;
          break;
        case 'paginationTemplate':
          this.options.paginationTemplate=value;
          needsReset=true;
          break;
        case 'paginationVisibleItems':
          this.options.paginationVisibleItems=value;
          this._updatePagination();
          break;
        case 'pauseOnHover':
          this.options.pauseOnHover=value;
          this._setItemClick();
          break;
        case 'slideDuration':
          this.options.slideDuration=value;
          break;
        case 'slideEasing':
          this.options.slideEasing=value;
          break;
        case 'slideTimeout':
          this.options.slideTimeout=value;
          break;
        case 'totalItems':
          this.options.totalItems=value;
          needsReset=true;
          break;

        case 'OnItemClick':
          this.options.OnItemClick=value;
          this._setItemClick();
          break;
        case 'OnAfterSlide':
          this.options.OnAfterSlide=value;
          break;

      }

      if (needsReset)
        this._resetCarousel();

		},

    _slideTo:function(index,callback){

      //this._debug('sliding to '+index, 'itemPaddingRight='+itemPaddingRight);

      this._isSliding=true;

      var items=this._getItems();
      var pos=0;
      var padding=this._itemPaddingRight;
      var border=this._borderWidth;

      this._toggleCarouselDialog(0);
      this._stopTimer();

      $.each(items,function(i){
        if (i<index){
          var item=$(items[i]);
          //pos+=$(items[i]).width()+($(items[i]).css('marginRight')*2);
          pos+=item.width()+(padding+border/**2*/);
        }
      });

      var self=this;
      this._carousel.animate({
        //marginLeft:'0px'
        marginLeft:'-'+pos+'px'
      }, {
        duration: self.options.slideDuration,
        specialEasing: {
          marginLeft: self.options.slideEasing
        },
        complete: function() {
          self._isSliding=false;
          callback();
        }
      });

    },

    _slideComplete:function(){

    //this._debug('slide complete');

      this._trimItems(this._lastDirection == 'prev' ? true : false);
      this._setItemClick();
      this._updatePagination();
      this._updateInformation();

      if (this._isPlaying){
        this._disableButtons();
        this._toggleButtonState(this._cmdPause,true);
        this._toggleButtonState(this._cmdStop,true);
        var self=this;
        window.setTimeout(function(){
          self._startTimer();
        },500);
      } else {
        this._enableButtons();
      }

      //if (this._isMouseOver && !self._isSliding && self._isPlaying && self.options.pauseOnHover)
//        self.pause();

      this._trigger('OnAfterSlide',null,{item:this,firstIndex:this._currentFirst,lastIndex:this._currentFirst+this._actualVisibleItems});

    },

    _resetCarousel:function(auto){

      var self=this;

      this._buildLayout();

      this._setNavigationItems();
      this._setPaginationItems();

      this._carousel.off('mouseover',this._mouseOverHandler).on('mouseover',{self:this,isItem:false},this._mouseOverHandler);
      this._carousel.off('mouseout',this._mouseOutHandler).on('mouseout',{self:this,isItem:false},this._mouseOutHandler);

      if (auto==undefined || auto==false){
        this._cmdPause.hide();
        this._cmdPlay.show();
        this._cmdStop.hide();
      } else {
        this._autoReset=true;
      }

      //this._debug('resetting '+autoReset);

      this._pb.progressbar({value:0});
      this._carousel.html('');
      this._paginationItems.html('');
      this._disableButtons();

      if (this.options.totalItems < 1){
        //this._paginationList.parent().parent().hide();
        //this._paginationInfo.parent().hide();
        this._parentContainer.hide();
        return;
      }

      this._actualVisibleItems = this.options.visibleItems > this.options.totalItems ? this.options.totalItems : this.options.visibleItems;
      this._actualItemLimit = this.options.itemLimit > this._actualVisibleItems ? this._actualVisibleItems : this.options.itemLimit;

      this._lastDirection='next';
      this._currentItemsLeft=0;
      this._hasBeenAdjusted=false;
      this._currentStart=0;
      this._currentEnd=this._actualVisibleItems-1;
      this._currentFirst=this._currentStart;

      var self=this;

      this._getCarouselData(this._currentStart,this._currentEnd,function(total,items){

        var popUps=[];
        for (var i=0;i<items.length;i++)
          popUps.push(items[i].popUp);
        if (popUps.length>0){
          self._addItems(popUps);
          self._setItemClick();
          self._updatePagination();
          self._updateInformation();

          if (self._autoReset){
            self._autoReset=false;

           self._slideTo(0,function(){
            if (self._isPlaying &&  self._totalPages > 1){
              self.resume();
            } else {
              self._toggleCarouselDialog(0);
              self._enableButtons();
              if (self._totalPages==1){
                self._toggleButtonState(self._cmdPlay,false);
                self._paginationList.parent().parent().hide();
                self._paginationInfo.parent().hide();
              }
            }
           });
          } else {
            self._enableButtons();
            if (self._totalPages==1){
              self._toggleButtonState(self._cmdPlay,false);
              self._paginationList.parent().parent().hide();
              self._paginationInfo.parent().hide();
            }
          }
        }

      });

    },

    _getItems:function(){

      //return items=this._carousel.children('li');
      return this._carousel.children('li');

    },

    _trimItems:function(going_back){

      var items=this._getItems();
      var index=this._hasBeenAdjusted ? this._currentItemsLeft : this._actualItemLimit;

      if (going_back==undefined || going_back==false){
        for (var i=index-1;i>-1;i--){
          $(items[i+index]).remove();
          //_debug('removing '+(i+index),i/*,currentStart,currentFirst*/);
        }
      }

      //just make sure no more items are still there
      items=this._getItems();
      for (var i=items.length-1;i>=this._actualVisibleItems;i--){
        $(items[i]).remove();
        //_debug('removing '+i);
      }

      this._measureItems();
    },

    _addItems:function(items,start){

      var s='';

      for (var i=0;i<items.length;i++)
        s+='<li class="'+this.options.itemClassName+'">'+items[i]+'</li>';

      if (start==undefined || start==false)
        this._carousel.append(s);
      else
        this._carousel.prepend(s);

      this._measureItems();

    },

    _getCSSValue:function(propertyName){

      var r=/(\d+)/;
      var match=r.exec(propertyName);

      if (match)
        return parseInt(match[1]);
      else
        return 0;

    },

    _measureItems:function(){

      var items=this._getItems();
      var itemsWidth=0;

      this._itemPaddingRight=0;
      this._borderWidth=0;

      for (var i=0;i<items.length;i++){
        if (this._itemPaddingRight==0)
          this._itemPaddingRight=this._getCSSValue($(items[i]).css('marginRight'));
        if (this._borderWidth==0)
          this._borderWidth=this._getCSSValue($(items[i]).css('borderLeftWidth'))+this._getCSSValue($(items[i]).css('borderRightWidth'));
        var w=$(items[i]).width() + (i < items.length - 1 ? this._itemPaddingRight : 0) + this._borderWidth;
        //this. _debug('item margin='+this._itemPaddingRight,'border='+this._borderWidth,'width='+w);
        itemsWidth+=w;
      }
      //this._debug('width='+itemsWidth*2);
      this._carousel.width(itemsWidth*2);

    },

    _itemsChanged:function(newTotal){

      this.options.totalItems=newTotal;
      var self=this;

      /* jnto request: no messages 19 Sep 2012 */
//      if (!this._isPlaying){
//        this._showErrorDialog('Items have changed, Carousel will now refresh data.','Carousel Error',{OK:function(e){
//          e.preventDefault();
//          $(this).dialog('close');
//          self._resetCarousel(true);
//          return false;
//        }},true);
//      } else {
//        this._resetCarousel(true);
//      }
      this._resetCarousel(true);

    },

    _toggleCarouselDialog:function(show){

      if (show)
        this._disableButtons();

      if (this._loadingImageVisible){
        if (show)
          this._parentContainer.find('.carouselLoading').show();
        else
          this._parentContainer.find('.carouselLoading').fadeOut(1000);
      }

    },

    _getCarouselData:function(start,end,callback){

      $.ajax({
        type:'GET',
        url:this.options.ajaxUrl,
        data:{start:start,end:end}
      }).complete(function(jqXHR, textStatus){
        if (textStatus!='success'){

          if (this._isPlaying)
            //pause();
            this.stop();

          this._toggleCarouselDialog(0);
          this._toggleButtonState(this._cmdPlay,false);
          this._toggleButtonState(this._cmdPause,false);

          /* jnto request: no messages 19 Sep 2012 */
          //this._showErrorDialog('Error reading carousel data from server.');

        } else {
          var arr=$.parseJSON(jqXHR.responseText);
          callback(arr['total'],arr['items']);
        }
      });

    },

    _mouseOverHandler:function(e){

      var self=e.data.self;

      //e.stopImmediatePropagation();

      if (!e.data.isItem)
        e.stopPropagation();
      else
        $(this).addClass(self.options.itemHoverClassName);

      self._isMouseOver=true;

      if (!self._isSliding && self._isPlaying && self.options.pauseOnHover)
        self.pause();

    },

    _mouseOutHandler:function(e){

      var self=e.data.self;

      //e.stopImmediatePropagation();

      if (!e.data.isItem)
        e.stopPropagation();
      else
        $(this).removeClass(self.options.itemHoverClassName);

      self._isMouseOver=false;

      if (!self._isSliding && self._isPlaying && self.options.pauseOnHover){
        if (self.options.mouseOutVariable!=null){
          if (eval(self.options.mouseOutVariable)==true)
            self.resume();
        } else {
          self.resume();
        }
      }

    },

    _setProgressBarValue:function(value){

      if (this._progressBarVisible)
        this._pb.progressbar('option','value',parseInt(value));
      else
        this._pb.hide();

    },

    _setItemClick:function(){

      var self=this;

      $('.userImagePopUp').live('click',function(e){
        e.preventDefault();
        if (!self._isSliding){
          if (self._isPlaying)
            self.pause();
           self._trigger('OnItemClick',e,{item:this});
        }
        return false;
      });

      this._carousel.children('li').each(function(i){
        $(this).off('mouseover',self._mouseOverHandler).on('mouseover',{self:self,isItem:true},self._mouseOverHandler);
        $(this).off('mouseout',self._mouseOutHandler).on('mouseout',{self:self,isItem:true},self._mouseOutHandler);
      });

    },

    _setNavigationItems:function(){

      var arr=this._extractNavigationTemplate();

      this._navigationList.html('');

      for (var i=0;i<arr.length;i++){
        if (i==arr.length-1)
          this._navigationList.append($('<li></li>').addClass('cmd'+arr[i].substr(0,1).toUpperCase()+arr[i].substr(1)).css({marginRight:0}));
        else
          this._navigationList.append($('<li></li>').addClass('cmd'+arr[i].substr(0,1).toUpperCase()+arr[i].substr(1)));
        if (arr[i]=='play')
          this._navigationList.append($('<li></li>').addClass('cmdPause'));
      }

      for (var i=0;i<this._defaultNavigationItems.length;i++){
        if (this._navigationList.find('.cmd'+this._defaultNavigationItems[i].substr(0,1).toUpperCase()+this._defaultNavigationItems[i].substr(1)).length==0){
          this._navigationList.append($('<li></li>').addClass('cmd'+this._defaultNavigationItems[i].substr(0,1).toUpperCase()+this._defaultNavigationItems[i].substr(1)).css('display','none'));
          if (this._defaultNavigationItems[i]=='play')
            this._navigationList.append($('<li></li>').addClass('cmdPause').css('display','none'));
        }
      }

      this._cmdPrev=this._parentContainer.find('.cmdPrev');
      this._cmdStop=this._parentContainer.find('.cmdStop');
      this._cmdPlay=this._parentContainer.find('.cmdPlay');
      this._cmdPause=this._parentContainer.find('.cmdPause');
      this._cmdNext=this._parentContainer.find('.cmdNext');
      this._cmdRefresh=this._parentContainer.find('.cmdRefresh');

      this._cmdPrev.attr('title','Previous');
      this._cmdStop.attr('title','Stop');
      this._cmdPlay.attr('title','Play');
      this._cmdPause.attr('title','Pause');
      this._cmdNext.attr('title','Next');
      this._cmdRefresh.attr('title','Reload');

      this._cmdPrev.button({
        text:false,
        icons:{primary:'ui-icon-seek-prev',secondary:null}
      });

      this._cmdNext.button({
        text:false,
        icons:{primary:'ui-icon-seek-next',secondary:null}
      });

      this._cmdPlay.button({
        text:false,
        icons:{primary:'ui-icon-play',secondary:null}
      });

      this._cmdPause.button({
        text:false,
        icons:{primary:'ui-icon-pause',secondary:null}
      });

      this._cmdStop.button({
        text:false,
        icons:{primary:'ui-icon-stop',secondary:null}
      });

      this._cmdRefresh.button({
        text:false,
        icons:{primary:'ui-icon-refresh',secondary:null}
      });

      var self=this;

      this._cmdStop.click(function(e){
        e.preventDefault();
        self.stop();
      });

      this._cmdRefresh.click(function(e){
        e.preventDefault();
        self._resetCarousel();
      });

      this._cmdPrev.click(function(e){
        e.preventDefault();
        self.goToPreviousPage();
      });

      this._cmdNext.click(function(e){
        e.preventDefault();
        self.goToNextPage();
      });

      this._cmdPlay.click(function(e){
        e.preventDefault();
        self._cmdPlay.fadeOut(50,function(){
          self._cmdPause.fadeIn(50,function(){
            self.resume();
          });
        });
      });

      this._cmdPause.click(function(e){
        e.preventDefault();
        self._cmdPause.fadeOut(50,function(){
          self._cmdPlay.fadeIn(50,function(){
            self.pause(true);
          });
        });
      });

    },

    _setPaginationItems:function(){

      var arr=this._extractPaginationTemplate();

      this._paginationList.html('');

      for (var i=0;i<arr.length;i++){
        if (i==arr.length-1)
          this._paginationList.append($('<li></li>').addClass('cmdP'+arr[i].substr(0,1).toUpperCase()+arr[i].substr(1)).css({marginRight:0}));
        else
          this._paginationList.append($('<li></li>').addClass('cmdP'+arr[i].substr(0,1).toUpperCase()+arr[i].substr(1)));
      }

      for (var i=0;i<this._defaultPaginationItems.length;i++){
        if (this._paginationList.find('.cmdP'+this._defaultPaginationItems[i].substr(0,1).toUpperCase()+this._defaultPaginationItems[i].substr(1)).length==0){
          this._paginationList.append($('<li></li>').addClass('cmdP'+this._defaultPaginationItems[i].substr(0,1).toUpperCase()+this._defaultPaginationItems[i].substr(1)).css('display','none'));
        }
      }

      this._cmdPFirst=this._parentContainer.find('.cmdPFirst');
      this._cmdPPrev=this._parentContainer.find('.cmdPPrev');
      this._cmdPItems=this._parentContainer.find('.cmdPItems');
      this._cmdPNext=this._parentContainer.find('.cmdPNext');
      this._cmdPLast=this._parentContainer.find('.cmdPLast');

      //$('.carouselPagination li:not(.cmdPItems)').button();
      this._parentContainer.find('.carouselPagination').children('li:not(.cmdPItems)').button();
      this._cmdPItems.html('<ul></ul>');
      this._paginationItems=this._cmdPItems.find('ul');

      this._cmdPFirst.button({
        text:false,
        icons:{primary:'ui-icon-seek-first',secondary:null}
      });

      this._cmdPPrev.button({
        text:false,
        icons:{primary:'ui-icon-seek-prev',secondary:null}
      });

      this._cmdPNext.button({
        text:false,
        icons:{primary:'ui-icon-seek-next',secondary:null}
      });

      this._cmdPLast.button({
        text:false,
        icons:{primary:'ui-icon-seek-end',secondary:null}
      });

      var self=this;

      this._cmdPFirst.click(function(e){
        e.preventDefault();
        self.goToPage(1);
      });

      this._cmdPLast.click(function(e){
        e.preventDefault();
        self.goToPage(self._totalPages);
      });

    },

    _updatePagination:function(){

      this._totalPages = 1 + Math.ceil((this.options.totalItems-this._actualVisibleItems) / this._actualItemLimit);

      for (var i=0;i<this._totalPages;i++){
        if (this._currentFirst + this._actualItemLimit <= (i + 1) * this._actualItemLimit){
          this._currentPage=i+1;
          break;
        }
      }

      var totalPageGroups=1;
      this._currentPageGroup=1;

      if (this._totalPages > this.options.paginationVisibleItems){
        totalPageGroups=Math.ceil(this._totalPages / this.options.paginationVisibleItems);
        this._currentPageGroup=Math.ceil(this._currentPage / this.options.paginationVisibleItems);
      }

      //_debug('currentPage='+currentPage,'currentFirst='+currentFirst,'actualItemLimit='+actualItemLimit);

      var start=((this._currentPageGroup-1)*this.options.paginationVisibleItems)+1;
      var pagesInThisGroup=0;

      for (var i=start; i<start + this.options.paginationVisibleItems; i++){
        if (i > this._totalPages) break;
        pagesInThisGroup++;
      }

      var items=this._paginationItems.children('li');

      this._paginationItems.html('');//reset

      for (var i=start; i < start + this.options.paginationVisibleItems; i++){

        if (i > this._totalPages)
          break;

        this._paginationItems.append('<li>'+i+'</li>');

        var item=this._paginationItems.find('li:last');

        if (this._currentPage==i){
          item.button({disabled:true});
        } else {
          item.button();
        }

        if (i == start + this.options.paginationVisibleItems - 1 || i == this._totalPages)
          item.css({marginRight:0}); /* ie fix */

        var self=this;
        item.click(function(e){
          e.preventDefault();
          self.goToPage(parseInt($(this).text()));
        });

        item.attr('title','Go To Page '+item.text());

      }

      var canGoForwardPageGroup = this._currentPageGroup < totalPageGroups ? true : false;
      var canGoBackPageGroup = totalPageGroups > 1 && this._currentPageGroup > 1 ? true : false;

      this._toggleButtonState(this._cmdPFirst,canGoBackPageGroup ? true : false);
      this._toggleButtonState(this._cmdPPrev,canGoBackPageGroup ? true : false);
      this._toggleButtonState(this._cmdPNext,canGoForwardPageGroup ? true : false);
      this._toggleButtonState(this._cmdPLast,canGoForwardPageGroup ? true : false);

      this._cmdPFirst.attr('title','Go To First Page');
      this._cmdPPrev.attr('title','');
      this._cmdPNext.attr('title','');
      this._cmdPLast.attr('title','Go To Last Page');

      if (canGoBackPageGroup){

        var first=start-this.options.paginationVisibleItems;
        var last=start-1;
        var self=this;

        this._cmdPPrev.attr('title', this._makePaginationTitle(first,last));
        this._cmdPPrev.unbind('click').click(function(e){
          e.preventDefault();
          var start=((self._currentPageGroup-1)*self.options.paginationVisibleItems)+1;
          self.goToPage(start-self.options.paginationVisibleItems);
        });

      }

      if (canGoForwardPageGroup){

        var first=start+this.options.paginationVisibleItems; /* currentPage needs to be changed to the start page of group */
        var last=start+this._paginationItems.children('li').length+1;//first+paginationVisibleItems;
        var self=this;

        if (last > this._totalPages)
          last=this._totalPages;

        this._cmdPNext.attr('title',this._makePaginationTitle(first,last));
        this._cmdPNext.unbind('click').click(function(e){
          e.preventDefault();
          self.goToPage(self._currentPage+self.options.paginationVisibleItems);
        });

      }

      if (!this.options.disabledPaginationItemsVisible){
        if (canGoBackPageGroup){
          this._cmdPFirst.show();
          this._cmdPPrev.show();
        } else {
          this._cmdPFirst.hide();
          this._cmdPPrev.hide();
        }
        if (canGoForwardPageGroup){
          this._cmdPNext.show();
          this._cmdPLast.show();
        } else {
          this._cmdPNext.hide();
          this._cmdPLast.hide();
        }
      }

    },

    _updateInformation:function(){

      /*update item information*/
      var $first=this._parentContainer.find('.carouselFirst');
      var $last=this._parentContainer.find('.carouselLast');
      var $total=this._parentContainer.find('.carouselTotal');

      $first.text(this._currentFirst+1);
      $last.text(parseInt($first.text())+this._actualVisibleItems-1);
      $total.text(this.options.totalItems);

      /*update page information*/
      var $page=this._parentContainer.find('.carouselPage');
      var $pageTotal=this._parentContainer.find('.carouselPageTotal');

      $page.text(this._currentPage);
      $pageTotal.text(this._totalPages);

    },

    _extractTemplate:function(template,isLayout){

      if (isLayout==undefined || isLayout==false){

        try {

          var r = /\{(.*?)\}/g,matches,arr = [];

          while (matches = r.exec(template))
            arr.push(decodeURIComponent(matches[1]));

          return arr;

        } catch (err){
          return [];
        }

      } else {

        try {

          var result=[];
          var r = /\[(.*?)\]/g,matches,rows=[];

          while (matches = r.exec(template))
            rows.push(decodeURIComponent(matches[1]));

          for (var i=0;i<rows.length;i++){
            var r = /\{(.*?)\}/g,matches,arr = [];
            while (matches = r.exec(rows[i]))
              arr.push(decodeURIComponent(matches[1]));
            result.push(arr);
          }

          return result;

        } catch (err){
          return new Array(new Array());
        }

      }


    },

    //_defaultLayoutItems:new Array( new Array('iteminfo','paginationinfo','loading'), new Array('items'), new Array('progressbar'), new Array('pager') ),

    _extractLayoutTemplate:function(){

      if (this.options.layoutTemplate==null){
        this.options.layoutTemplate='';
        for (var i=0;i<this._defaultLayoutItems.length;i++){  /* rows */
          this.options.layoutTemplate+='[';
          for (var j=0;j<this._defaultLayoutItems[i].length;j++){  /* items per row */
            this.options.layoutTemplate+='{'+this._defaultLayoutItems[i][j]+'}';
          }
          this.options.layoutTemplate+=']';
        }
      }

      return this._extractTemplate(this.options.layoutTemplate,true);

    },

    _extractPaginationTemplate:function(){

      if (this.options.paginationTemplate==null){
        this.options.paginationTemplate='';
        for (var i=0;i<this._defaultPaginationItems.length;i++)
          this.options.paginationTemplate+='{'+this._defaultPaginationItems[i]+'}';
      }

      return this._extractTemplate(this.options.paginationTemplate);

    },

    _extractNavigationTemplate:function(){

      if (this.options.navigationTemplate==null){
        this.options.navigationTemplate='';
        for (var i=0;i<this._defaultNavigationItems.length;i++)
          this.options.navigationTemplate+='{'+this._defaultNavigationItems[i]+'}';
      }

      return this._extractTemplate(this.options.navigationTemplate);

    },

    _makePaginationTitle:function(first,last){

      var s='Go To Page';

      if (last > first)
        s+='s';

      s+=' '+first;

      if (last > first)
        s+=' to '+last;

      return s;

    },

    _toggleButtonState:function(button,enabled){

      button.button('option','disabled',enabled==undefined || enabled==true? false:true);

    },

    _canGoBack:function(){

      return this._currentStart <= 0 ? false : true;

    },

    _canGoForward:function(){

      return this._currentEnd >= this.options.totalItems-1 ? false : true;

    },

    _disableButtons:function(){

      this._toggleButtonState(this._cmdPrev,false);
      this._toggleButtonState(this._cmdNext,false);
      this._toggleButtonState(this._cmdPFirst,false);
      this._toggleButtonState(this._cmdPPrev,false);
      this._toggleButtonState(this._cmdPNext,false);
      this._toggleButtonState(this._cmdPLast,false);

      for (var i=0;i<this._totalPages;i++)
        this._toggleButtonState(this._paginationItems.children('li').eq(i),false);

      if (this._cmdPlay.is(':visible'))
        this._toggleButtonState(this._cmdPlay,false);

      if (this._cmdPause.is(':visible'))
        this._toggleButtonState(this._cmdPause,false);

      if (this._cmdStop.is(':visible'))
        this._toggleButtonState(this._cmdStop,false);

      if (this._cmdRefresh.is(':visible'))
        this._toggleButtonState(this._cmdRefresh,false);

    },

    _enableButtons:function(){

      if (this._canGoBack())
        this._toggleButtonState(this._cmdPrev,true);

      if (this._canGoForward())
        this._toggleButtonState(this._cmdNext,true);

      if (this._cmdPlay.is(':visible'))
        this._toggleButtonState(this._cmdPlay,true);

      if (this._cmdPause.is(':visible'))
        this._toggleButtonState(this._cmdPause,true);

      if (this._cmdStop.is(':visible'))
        this._toggleButtonState(this._cmdStop,true);

      if (this._cmdRefresh.is(':visible'))
        this._toggleButtonState(this._cmdRefresh,true);

    },

    _startTimer:function(){

      if (this._pbTimerId==null){
        var self=this;
        this._pbTimerId=window.setInterval(function(){self._updateProgressBar();},100);
        //this._debug('timer started');
      }

    },

    _stopTimer:function(){

      if (this._pbTimerId!=null){
        window.clearInterval(this._pbTimerId);
        this._pbTimerId=null;
        //this._debug('timer stopped');
      }

    },

    _updateProgressBar:function(){

      if (!this._isPlaying){
        this._stopTimer();
        this._pb.hide();
        return;
      }

      if (this._isMouseOver && !this._isSliding && this._isPlaying && this.options.pauseOnHover){
        this.pause();
        return;
      }

      var amount=this._pbCounter * 100;
      var percentage=(amount / this.options.slideTimeout) * 100;

      this._setProgressBarValue(percentage);

      if (percentage >= 100){
        this._stopTimer();
        this._pbCounter=0;
        this._setProgressBarValue(100);

        var page=this._currentPage+1;

        if (page > this._totalPages)
          page=1;

        this.goToPage(page);

        return;
      }

      this._pbCounter++;

    },

    _showErrorDialog:function(message,title,buttons,hide_close){

      if (title==undefined)
        title='Carousel Error';

      if (buttons==undefined){
        buttons={'OK': function() { $(this).dialog('close'); }};
      }

      if (hide_close==undefined)
        hide_close=false;

      //dialog.parent().children('.ui-dialog-titlebar').hide();

      if (hide_close)
        this._dialog.parent().find('.ui-dialog-titlebar-close').hide();
      else
        this._dialog.parent().find('.ui-dialog-titlebar-close').show();

      this._dialog.dialog('option','title',title);
      this._dialog.dialog('option','buttons',buttons);
      this._dialog.find('p').text(message);

      this._dialog.dialog('open');

    },

    _checkForExistingItems:function(){

      var currentItems=new Array();
      var requestedItems=new Array();

      for (var i=0;i<this._actualVisibleItems;i++)
        currentItems[i]=this._currentFirst+i;

      for (var i=this._currentStart;i<this._currentEnd+1;i++)
        requestedItems.push(i);

      for (var i=0;i<currentItems.length;i++){
        for (var j=requestedItems.length-1;j>-1;j--){/* gone backwards because removing from array will mess up the indexes otherwise */
          if (currentItems[i] == requestedItems[j]){
            if (this._tempIndex==-1)
              this._tempIndex=i;//slide to this item's carousel index afterwards (if moving forward)
            requestedItems.remove(j);
          }
        }
      }

      return requestedItems;

    },

    _debug:function(var1,var2,var3,var4,var5){

      if (window.console && window.console.debug){
        if (var5!=undefined)
          console.debug(var1,var2,var3,var4,var5);
        else if (var4!=undefined)
          console.debug(var1,var2,var3,var4);
        else if (var3!=undefined)
          console.debug(var1,var2,var3);
        else if (var2!=undefined)
          console.debug(var1,var2);
        else
          console.debug(var1);
      } else if (window.console && window.console.log){
        if (var5!=undefined)
          console.log(var1,var2,var3,var4,var5);
        else if (var4!=undefined)
          console.log(var1,var2,var3,var4);
        else if (var3!=undefined)
          console.log(var1,var2,var3);
        else if (var2!=undefined)
          console.log(var1,var2);
        else
          console.log(var1);
      }

    },

    /* Public Functions */

    destroy: function() {

      if (this._parentContainer!=null){
        this._parentContainer.replaceWith($(this._element));
        this._parentContainer=null;
      }

//			$(window).unbind("resize");

		},

    isPlaying:function(){

      return this._isPlaying;

    },

    isSliding:function(){

      return this._isSliding;

    },

    play:function(){

      this._isPlaying=true;
      if (this._progressBarVisible)
        this._pb.show();
      this._setProgressBarValue(0);
      this._pbCounter=0;
      this._disableButtons();
      this._cmdStop.show();
      this._toggleButtonState(this._cmdPause,true);
      this._toggleButtonState(this._cmdStop,true);
      this._startTimer();

      //this._debug('playing');

    },

    resume:function(){

      //if (!this._pb.is(':visible')){
      if (!this._isPlaying){
        this.play();
        return;
      }

      this._disableButtons();
      this._toggleButtonState(this._cmdPause,true);
      this._toggleButtonState(this._cmdStop,true);
      this._isPlaying=true;
      this._startTimer();

      //this._debug('resuming');

    },

    pause:function(button_event){

      if (button_event==true){
        this._enableButtons();
        this._updatePagination();
        this._isPlaying=false;
      }

      this._stopTimer();

      //this._debug('paused');

    },

    stop:function(){

      this._isPlaying=false;
      this._stopTimer();
      this._pb.hide();
      this._cmdPause.hide();
      this._cmdPlay.show();
      this._cmdStop.hide();
      this._enableButtons();
      this._updatePagination();

      //this._debug('stopped');

    },

    goToPage:function(page){

      if (this._currentPage > page)
        this.goToPreviousPage(this._currentPage-page);
      else
        this.goToNextPage(page-this._currentPage);

    },

    /*
    @function: goToPreviousPage
    @params:
    @integer  pages
    The number of pages to go back by.
     */
    goToPreviousPage:function(pages){

      if (pages==undefined)
        pages=1;

      pages=parseInt(pages);

      tempIndex=-1;
      var page=this._currentPage-pages;
      this._currentStart = (this._actualItemLimit * (page-1));

      if (pages > 1){

        if (this._currentStart < 0)
          this._currentStart=0;

        this._hasBeenAdjusted=true;
        this._currentItemsLeft=this._actualVisibleItems;
        this._currentEnd=this._currentStart+this._currentItemsLeft-1;

        var requestedItems=this._checkForExistingItems();

        if (this._tempIndex > -1){
          this._currentEnd=requestedItems[requestedItems.length-1];
          this._currentItemsLeft=requestedItems.length;
        }

      } else {

        this._currentItemsLeft=this._actualItemLimit;//Math.abs(totalItems-currentEnd-1);
        this._hasBeenAdjusted=false;

        if (this._currentStart < 0){
          this._currentItemsLeft=Math.abs(this._currentStart);
          this._currentStart=0;
          this._hasBeenAdjusted=true;
        }

        this._currentEnd = this._currentStart + (this._hasBeenAdjusted ? this._currentItemsLeft : this._actualItemLimit) - 1;

        var requestedItems=this._checkForExistingItems();

        if (this._tempIndex > -1){
          this._hasBeenAdjusted=true;
          this._currentEnd=requestedItems[requestedItems.length-1];
          this._currentItemsLeft=requestedItems.length;
        }

      }

      this._currentFirst=this._currentStart;

      this._lastDirection='prev';
      this._toggleCarouselDialog(1);
      var self=this;

      this._getCarouselData(this._currentStart,this._currentEnd,function(total,items){

        if (total!=self.options.totalItems){
          self._itemsChanged(total);
          return;
        }

        var popUps=[];

        //_debug(items.length+' new items received');

        /*
        keep things simple:

        add current 6 items again
        silently move to 6
        update 0-5 with new data
        slide to 0
        remove 6-11

        */

        self._arrImageData=[];

        for (var i=0;i<items.length;i++){
          var r=/src\="(.*?)"/;
          var match=r.exec(items[i].popUp);
          items[i].popUp=items[i].popUp.replace( match[0],'src=""');
          self._arrImageData.push(new imageData(match[1].replace('&amp;','&')));
        }

        for (var i=0;i<items.length;i++)
          popUps.push(items[i].popUp);

        items=self._getItems();

        var arr2=[];
        var max=self._hasBeenAdjusted?self._currentItemsLeft:self._actualItemLimit;
        for (var i=self._actualVisibleItems-max;i<=self._actualVisibleItems-1;i++){
          arr2.push('');
        }
        self._addItems(arr2);

        var items2=self._getItems();
        for (var i=items2.length-1;i>max-1;i--){
          $(items2[i]).html( $(items2[i-max]).html());
        }


        //instead of adding items, add or update
        //then moveto max silently
        //then update 0-max with new items
        //then slide to 0
        //then trim old items

        var pos=0;
        var padding=self._itemPaddingRight;
        var border=self._borderWidth;
        // 924 = 156 * 6
        var index=max;

        $.each(items,function(i){
          if (i<index){
            var item=$(items[i]);
            //pos+=$(items[i]).width()+($(items[i]).css('marginRight')*2);
            pos+=item.width()+(padding+border/**2*/);
          }
        });

        self._carousel.css('marginLeft','-'+pos+'px');

        for (var i=0;i<max;i++){
          $(items[i]).html( popUps[i]);
          var img=$(items[i]).find('img');

          $(img).load(function(){

            var currentIndex;

            for (var i=0;i<self._arrImageData.length;i++){
              if (self._arrImageData[i].src==$(this).attr('src')){
                currentIndex=i;
                break;
              }
            }

            self._arrImageData[currentIndex].loaded=true;
            var counter=0;
            var max=self._hasBeenAdjusted?self._currentItemsLeft:self._actualItemLimit;
            for (var j=0;j<max;j++){
              if (self._arrImageData[j].loaded==true)
                counter++;
            }
            if (counter==max){
              self._slideTo(0,function(){
                self._slideComplete();
              });
            }
          });
          $(img).attr('src',self._arrImageData[i].src);
        }

      });

    },

    goToNextPage:function(pages){

      if (pages==undefined)
        pages=1;

      pages=parseInt(pages);
      this._tempIndex=-1;

      var page=this._currentPage+pages;
      this._currentEnd = this._actualVisibleItems + ((page-1) * this._actualItemLimit) - 1;

      if (pages > 1){

        if (this._currentEnd > this.options.totalItems-1)
          this._currentEnd=this.options.totalItems-1;

        this._hasBeenAdjusted=true;
        this._currentItemsLeft=this._actualVisibleItems/*-1*/;
        this._currentStart=this._currentEnd-this._currentItemsLeft+1;

        var requestedItems=this._checkForExistingItems();

        if (this._tempIndex > -1){
          this._currentStart=requestedItems[0];
          this._currentItemsLeft=requestedItems.length;
        }

        this._currentFirst=this._currentStart-this._actualVisibleItems+this._currentItemsLeft;

      } else {

        this._currentItemsLeft=Math.abs(this.options.totalItems-this._currentEnd-1);
        this._hasBeenAdjusted=false;

        if (this._currentEnd > this.options.totalItems-1){
          this._currentEnd=this.options.totalItems-1;
          this._hasBeenAdjusted=true;
        }

        if (this._hasBeenAdjusted){
          this._currentStart=this._currentEnd-this._currentItemsLeft+1;
          this._currentFirst=this._currentStart-this._actualVisibleItems+this._currentItemsLeft;
        } else {
          this._currentStart=this._currentEnd-this._actualItemLimit+1;
          this._currentFirst=this._currentStart-this._actualVisibleItems+this._actualItemLimit;
        }

      }

      this._lastDirection='next';
      this._toggleCarouselDialog(1);
      var self=this;

      this._getCarouselData(this._currentStart,this._currentEnd,function(total,items){

        if (total!=self.options.totalItems){
          self._itemsChanged(total);
          return;
        }

        var popUps=[];

        //_debug(items.length+' new items received');

        //remove src attribute from image element
        self._arrImageData=[];

        for (var i=0;i<items.length;i++){
          var r=/src\="(.*?)"/;
          var match=r.exec(items[i].popUp);
          items[i].popUp=items[i].popUp.replace( match[0],'src=""');
          self._arrImageData.push(new imageData(match[1].replace('&amp;','&')));
        }

        //end remove src

        for (var i=0;i<items.length;i++){
          popUps.push(items[i].popUp);
        }

        self._addItems(popUps);

        //catch load

        items=self._getItems();

        for (var i=0;i<self._arrImageData.length;i++){

          var img=$(items[ self._actualVisibleItems+i]).find('img');

          $(img).load(function(){

            var currentIndex;

            for (var i=0;i<self._arrImageData.length;i++){
              if (self._arrImageData[i].src==$(this).attr('src')){
                currentIndex=i;
                break;
              }
            }

            self._arrImageData[currentIndex].loaded=true;
            var counter=0;

            for (var j=0;j<self._arrImageData.length;j++){
              if (self._arrImageData[j].loaded==true)
                counter++;
            }

            var index = self._hasBeenAdjusted ? self._currentItemsLeft : self._actualItemLimit;
            if (counter==index){

              self._slideTo(self._tempIndex == -1 ? index : self._tempIndex,function(){
                //copy new items to 0-5
                //silently move back to 0
                //remove old items 6-11

                var items=self._getItems();
                var j=self._hasBeenAdjusted?self._currentItemsLeft:self._actualItemLimit;

                for (var i=0;i<j;i++){
                  $(items[i]).html( $(items[i+j]).html() );
                  //_debug('setting '+i+' contents to '+(i+j)+' contents');
                }

                self._carousel.css('marginLeft',0);
                self._slideComplete();

                if ($.browser.msie && parseInt($.browser.version, 10) < 9)
                  self._carousel.css('marginLeft',1); /* fixes a bug in ie7+8 where the scroll seems to step once */

              });

            }
          });
          $(img).attr('src',self._arrImageData[i].src);
        }

        //end catch load

        //goToNext(actualItemLimit);
      });

    } // end function

	});

})(jQuery);