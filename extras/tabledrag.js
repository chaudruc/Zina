/**
 * Drag and drop table rows with field manipulation.
 * See Drupal.org for code/license/comments
 */
(function($) {

Drupal.behaviors.tableDrag = function(context) {
  for (var base in Drupal.settings.tableDrag) {
    if (!$('#' + base + '.tabledrag-processed', context).size()) {
      var tableSettings = Drupal.settings.tableDrag[base];
      $('#' + base).filter(':not(.tabledrag-processed)').each(function() {
        Drupal.tableDrag[base] = new Drupal.tableDrag(this, tableSettings);
      });
      $('#' + base).addClass('tabledrag-processed');
    }
  }
};

Drupal.tableDrag = function(table, tableSettings) {
  var self = this;
  this.table = table;
  this.tableSettings = tableSettings;
  this.dragObject = null;
  this.rowObject = null;
  this.oldRowElement = null;
  this.oldY = 0;
  this.changed = false;
  this.maxDepth = 0;
  this.rtl = $(this.table).css('direction') == 'rtl' ? -1 : 1;
  this.scrollSettings = { amount: 4, interval: 50, trigger: 70 };
  this.scrollInterval = null;
  this.scrollY = 0;
  this.windowHeight = 0;
  this.indentEnabled = false;
  for (group in tableSettings) {
    for (n in tableSettings[group]) {
      if (tableSettings[group][n]['relationship'] == 'parent') {
        this.indentEnabled = true;
      }
      if (tableSettings[group][n]['limit'] > 0) {
        this.maxDepth = tableSettings[group][n]['limit'];
      }
    }
  }
  if (this.indentEnabled) {
    this.indentCount = 1;
    var indent = Drupal.theme('tableDragIndentation');
    var testCell = $('tr.draggable:first td:first', table).prepend(indent).prepend(indent);
    this.indentAmount = $('.indentation', testCell).get(1).offsetLeft - $('.indentation', testCell).get(0).offsetLeft;
    $('.indentation', testCell).slice(0, 2).remove();
  }

  $('tr.draggable', table).each(function() { self.makeDraggable(this); });

  this.hideColumns();

  $(document).bind('mousemove', function(event) { return self.dragRow(event, self); });
  $(document).bind('mouseup', function(event) { return self.dropRow(event, self); });
};

Drupal.tableDrag.prototype.hideColumns = function(){
  for (var group in this.tableSettings) {
    for (var d in this.tableSettings[group]) {
      var field = $('.' + this.tableSettings[group][d]['target'] + ':first', this.table);
      if (field.size() && this.tableSettings[group][d]['hidden']) {
        var hidden = this.tableSettings[group][d]['hidden'];
        var cell = field.parents('td:first');
        break;
      }
    }

    if (hidden && cell[0] && cell.css('display') != 'none') {
      var columnIndex = $('td', cell.parent()).index(cell.get(0)) + 1;
      var headerIndex = $('td:not(:hidden)', cell.parent()).index(cell.get(0)) + 1;
      $('tr', this.table).each(function(){
        var row = $(this);
        var parentTag = row.parent().get(0).tagName.toLowerCase();
        var index = (parentTag == 'thead') ? headerIndex : columnIndex;
        row.children().each(function(n) {
          if (n < index) {
            index -= (this.colSpan && this.colSpan > 1) ? this.colSpan - 1 : 0;
          }
        });
        if (index > 0) {
          cell = row.children(':nth-child(' + index + ')');
          if (cell[0].colSpan > 1) {
            cell[0].colSpan = cell[0].colSpan - 1;
          }
          else {
            parentTag == 'thead' ? cell.remove() : cell.css('display', 'none');
          }
        }
      });
    }
  }
};

Drupal.tableDrag.prototype.rowSettings = function(group, row) {
  var field = $('.' + group, row);
  for (delta in this.tableSettings[group]) {
    var targetClass = this.tableSettings[group][delta]['target'];
    if (field.is('.' + targetClass)) {
      var rowSettings = new Object();
      for (var n in this.tableSettings[group][delta]) {
        rowSettings[n] = this.tableSettings[group][delta][n];
      }
      return rowSettings;
    }
  }
};

Drupal.tableDrag.prototype.makeDraggable = function(item) {
  var self = this;
  var handle = $('<a href="#" class="tabledrag-handle"><div class="handle">&nbsp;</div></a>').attr('title', Drupal.t('Drag to re-order'));
  if ($('td:first .indentation:last', item).after(handle).size()) {
    self.indentCount = Math.max($('.indentation', item).size(), self.indentCount);
  }
  else {
    $('td:first', item).prepend(handle);
  }

  handle.hover(function() {
    self.dragObject == null ? $(this).addClass('tabledrag-handle-hover') : null;
  }, function() {
    self.dragObject == null ? $(this).removeClass('tabledrag-handle-hover') : null;
  });

  handle.mousedown(function(event) {
    self.dragObject = new Object();
    self.dragObject.initMouseOffset = self.getMouseOffset(item, event);
    self.dragObject.initMouseCoords = self.mouseCoords(event);
    if (self.indentEnabled) {
      self.dragObject.indentMousePos = self.dragObject.initMouseCoords;
    }
    if (self.rowObject) {
      $('a.tabledrag-handle', self.rowObject.element).blur();
    }
    self.rowObject = new self.row(item, 'mouse', self.indentEnabled, self.maxDepth, true);
    self.table.topY = self.getPosition(self.table).y;
    self.table.bottomY = self.table.topY + self.table.offsetHeight;
    $(this).addClass('tabledrag-handle-hover');
    $(item).addClass('drag');
    $('body').addClass('drag');
    if (self.oldRowElement) {
      $(self.oldRowElement).removeClass('drag-previous');
    }
    if (navigator.userAgent.indexOf('MSIE 6.') != -1) {
      $('select', this.table).css('display', 'none');
    }
    self.safeBlur = false;
    self.onDrag();
    return false;
  });
  handle.click(function() {
    return false;
  });

  handle.focus(function() {
    $(this).addClass('tabledrag-handle-hover');
    self.safeBlur = true;
  });
  handle.blur(function(event) {
    $(this).removeClass('tabledrag-handle-hover');
    if (self.rowObject && self.safeBlur) {
      self.dropRow(event, self);
    }
  });
  handle.keydown(function(event) {
    if (event.keyCode != 9 && !self.rowObject) {
      self.rowObject = new self.row(item, 'keyboard', self.indentEnabled, self.maxDepth, true);
    }

    var keyChange = false;
    switch (event.keyCode) {
      case 37:
      case 63234:
        keyChange = true;
        self.rowObject.indent(-1 * self.rtl);
        break;
      case 38:
      case 63232:
        var previousRow = $(self.rowObject.element).prev('tr').get(0);
        while (previousRow && $(previousRow).is(':hidden')) {
          previousRow = $(previousRow).prev('tr').get(0);
        }
        if (previousRow) {
          self.safeBlur = false;
          self.rowObject.direction = 'up';
          keyChange = true;

          if ($(item).is('.tabledrag-root')) {
            var groupHeight = 0;
            while (previousRow && $('.indentation', previousRow).size()) {
              previousRow = $(previousRow).prev('tr').get(0);
              groupHeight += $(previousRow).is(':hidden') ? 0 : previousRow.offsetHeight;
            }
            if (previousRow) {
              self.rowObject.swap('before', previousRow);
              window.scrollBy(0, -groupHeight);
            }
          }
          else if (self.table.tBodies[0].rows[0] != previousRow || $(previousRow).is('.draggable')) {
            self.rowObject.swap('before', previousRow);
            self.rowObject.interval = null;
            self.rowObject.indent(0);
            window.scrollBy(0, -parseInt(item.offsetHeight));
          }
          handle.get(0).focus();
        }
        break;
      case 39:
      case 63235:
        keyChange = true;
        self.rowObject.indent(1 * self.rtl);
        break;
      case 40:
      case 63233:
        var nextRow = $(self.rowObject.group).filter(':last').next('tr').get(0);
        while (nextRow && $(nextRow).is(':hidden')) {
          nextRow = $(nextRow).next('tr').get(0);
        }
        if (nextRow) {
          self.safeBlur = false;
          self.rowObject.direction = 'down';
          keyChange = true;

          if ($(item).is('.tabledrag-root')) {
            var groupHeight = 0;
            nextGroup = new self.row(nextRow, 'keyboard', self.indentEnabled, self.maxDepth, false);
            if (nextGroup) {
              $(nextGroup.group).each(function () {groupHeight += $(this).is(':hidden') ? 0 : this.offsetHeight});
              nextGroupRow = $(nextGroup.group).filter(':last').get(0);
              self.rowObject.swap('after', nextGroupRow);
              window.scrollBy(0, parseInt(groupHeight));
            }
          }
          else {
            self.rowObject.swap('after', nextRow);
            self.rowObject.interval = null;
            self.rowObject.indent(0);
            window.scrollBy(0, parseInt(item.offsetHeight));
          }
          handle.get(0).focus();
        }
        break;
    }

    if (self.rowObject && self.rowObject.changed == true) {
      $(item).addClass('drag');
      if (self.oldRowElement) {
        $(self.oldRowElement).removeClass('drag-previous');
      }
      self.oldRowElement = item;
      self.restripeTable();
      self.onDrag();
    }

    if (keyChange) {
      return false;
    }
  });
  handle.keypress(function(event) {
    switch (event.keyCode) {
      case 37:
      case 38:
      case 39:
      case 40:
        return false;
    }
  });
};

Drupal.tableDrag.prototype.dragRow = function(event, self) {
  if (self.dragObject) {
    self.currentMouseCoords = self.mouseCoords(event);
    var y = self.currentMouseCoords.y - self.dragObject.initMouseOffset.y;
    var x = self.currentMouseCoords.x - self.dragObject.initMouseOffset.x;
    if (y != self.oldY) {
      self.rowObject.direction = y > self.oldY ? 'down' : 'up';
      self.oldY = y;
      var scrollAmount = self.checkScroll(self.currentMouseCoords.y);
      clearInterval(self.scrollInterval);
      if (scrollAmount > 0 && self.rowObject.direction == 'down' || scrollAmount < 0 && self.rowObject.direction == 'up') {
        self.setScroll(scrollAmount);
      }
      var currentRow = self.findDropTargetRow(x, y);
      if (currentRow) {
        if (self.rowObject.direction == 'down') {
          self.rowObject.swap('after', currentRow, self);
        }
        else {
          self.rowObject.swap('before', currentRow, self);
        }
        self.restripeTable();
      }
    }
    if (self.indentEnabled) {
      var xDiff = self.currentMouseCoords.x - self.dragObject.indentMousePos.x;
      var indentDiff = Math.round(xDiff / self.indentAmount * self.rtl);
      var indentChange = self.rowObject.indent(indentDiff);
      self.dragObject.indentMousePos.x += self.indentAmount * indentChange * self.rtl;
      self.indentCount = Math.max(self.indentCount, self.rowObject.indents);
    }
    return false;
  }
};

Drupal.tableDrag.prototype.dropRow = function(event, self) {
  if (self.rowObject != null) {
    var droppedRow = self.rowObject.element;
    if (self.rowObject.changed == true) {
      self.updateFields(droppedRow);
      for (var group in self.tableSettings) {
        var rowSettings = self.rowSettings(group, droppedRow);
        if (rowSettings.relationship == 'group') {
          for (n in self.rowObject.children) {
            self.updateField(self.rowObject.children[n], group);
          }
        }
      }

      self.rowObject.markChanged();
      if (self.changed == false) {
        $(Drupal.theme('tableDragChangedWarning')).insertAfter(self.table).hide().fadeIn('slow');
        self.changed = true;
      }
    }

    if (self.indentEnabled) {
		 //XXX
      self.rowObject.removeIndentClasses();
/*
  for (var n in self.rowObject.children) {
    $('.indentation', self.rowObject.children[n]).removeClass('tree-child')
    $('.indentation', self.rowObject.children[n]).removeClass('tree-child-first')
    $('.indentation', self.rowObject.children[n]).removeClass('tree-child-last')
    $('.indentation', self.rowObject.children[n]).removeClass('tree-child-horizontal');
  }
  */
    }
    if (self.oldRowElement) {
      $(self.oldRowElement).removeClass('drag-previous');
    }
    $(droppedRow).removeClass('drag').addClass('drag-previous');
    self.oldRowElement = droppedRow;
    self.onDrop();
    self.rowObject = null;
  }

  if (self.dragObject != null) {
    $('.tabledrag-handle', droppedRow).removeClass('tabledrag-handle-hover');
    self.dragObject = null;
    $('body').removeClass('drag');
    clearInterval(self.scrollInterval);
    if (navigator.userAgent.indexOf('MSIE 6.') != -1) {
      $('select', this.table).css('display', 'block');
    }
  }
};

Drupal.tableDrag.prototype.getPosition = function(element){
  var left = 0;
  var top  = 0;
  if (element.offsetHeight == 0) {
    element = element.firstChild; // a table cell
  }

  while (element.offsetParent){
    left   += element.offsetLeft;
    top    += element.offsetTop;
    element = element.offsetParent;
  }

  left += element.offsetLeft;
  top  += element.offsetTop;

  return {x:left, y:top};
};

Drupal.tableDrag.prototype.mouseCoords = function(event){
  if (event.pageX || event.pageY) {
    return {x:event.pageX, y:event.pageY};
  }
  return {
    x:event.clientX + document.body.scrollLeft - document.body.clientLeft,
    y:event.clientY + document.body.scrollTop  - document.body.clientTop
  };
};

Drupal.tableDrag.prototype.getMouseOffset = function(target, event) {
  var docPos   = this.getPosition(target);
  var mousePos = this.mouseCoords(event);
  return {x:mousePos.x - docPos.x, y:mousePos.y - docPos.y};
};

Drupal.tableDrag.prototype.findDropTargetRow = function(x, y) {
  var rows = this.table.tBodies[0].rows;
  for (var n=0; n<rows.length; n++) {
    var row = rows[n];
    var indentDiff = 0;
    if (row.offsetHeight == 0) {
      var rowY = this.getPosition(row.firstChild).y;
      var rowHeight = parseInt(row.firstChild.offsetHeight)/2;
    }
    else {
      var rowY = this.getPosition(row).y;
      var rowHeight = parseInt(row.offsetHeight)/2;
    }

    if ((y > (rowY - rowHeight)) && (y < (rowY + rowHeight))) {
      if (this.indentEnabled) {
        for (n in this.rowObject.group) {
          if (this.rowObject.group[n] == row) {
            return null;
          }
        }
      }
      if (!this.rowObject.isValidSwap(row)) {
        return null;
      }

      while ($(row).is(':hidden') && $(row).prev('tr').is(':hidden')) {
        row = $(row).prev('tr').get(0);
      }
      return row;
    }
  }
  return null;
};

Drupal.tableDrag.prototype.updateFields = function(changedRow) {
  for (var group in this.tableSettings) {
    this.updateField(changedRow, group);
  }
};

Drupal.tableDrag.prototype.updateField = function(changedRow, group) {
  var rowSettings = this.rowSettings(group, changedRow);

  if (rowSettings.relationship == 'self' || rowSettings.relationship == 'group') {
    var sourceRow = changedRow;
  }
  else if (rowSettings.relationship == 'sibling') {
    var previousRow = $(changedRow).prev('tr').get(0);
    var nextRow = $(changedRow).next('tr').get(0);
    var sourceRow = changedRow;
    if ($(previousRow).is('.draggable') && $('.' + group, previousRow).length) {
      if (this.indentEnabled) {
        if ($('.indentations', previousRow).size() == $('.indentations', changedRow)) {
          sourceRow = previousRow;
        }
      }
      else {
        sourceRow = previousRow;
      }
    }
    else if ($(nextRow).is('.draggable') && $('.' + group, nextRow).length) {
      if (this.indentEnabled) {
        if ($('.indentations', nextRow).size() == $('.indentations', changedRow)) {
          sourceRow = nextRow;
        }
      }
      else {
        sourceRow = nextRow;
      }
    }
  }
  else if (rowSettings.relationship == 'parent') {
    var previousRow = $(changedRow).prev('tr');
    while (previousRow.length && $('.indentation', previousRow).length >= this.rowObject.indents) {
      previousRow = previousRow.prev('tr');
    }
    if (previousRow.length) {
      sourceRow = previousRow[0];
    }
    else {
      sourceRow = $('tr.draggable:first').get(0);
      if (sourceRow == this.rowObject.element) {
        sourceRow = $(this.rowObject.group[this.rowObject.group.length - 1]).next('tr.draggable').get(0);
      }
      var useSibling = true;
    }
  }

  this.copyDragClasses(sourceRow, changedRow, group);
  rowSettings = this.rowSettings(group, changedRow);

  if (useSibling) {
    rowSettings.relationship = 'sibling';
    rowSettings.source = rowSettings.target;
  }

  var targetClass = '.' + rowSettings.target;
  var targetElement = $(targetClass, changedRow).get(0);

  if (targetElement) {
    var sourceClass = '.' + rowSettings.source;
    var sourceElement = $(sourceClass, sourceRow).get(0);
    switch (rowSettings.action) {
      case 'depth':
        targetElement.value = $('.indentation', $(sourceElement).parents('tr:first')).size();
        break;
      case 'match':
        targetElement.value = sourceElement.value;
        break;
      case 'order':
        var siblings = this.rowObject.findSiblings(rowSettings);
        if ($(targetElement).is('select')) {
          var values = new Array();
          $('option', targetElement).each(function() {
            values.push(this.value);
          });
          var maxVal = values[values.length - 1];
          $(targetClass, siblings).each(function() {
            if (values.length > 0) {
              this.value = values.shift();
            }
            else {
              this.value = maxVal;
            }
          });
        }
        else {
          var weight = parseInt($(targetClass, siblings[0]).val()) || 0;
          $(targetClass, siblings).each(function() {
            this.value = weight;
            weight++;
          });
        }
        break;
    }
  }
};

Drupal.tableDrag.prototype.copyDragClasses = function(sourceRow, targetRow, group) {
  var sourceElement = $('.' + group, sourceRow);
  var targetElement = $('.' + group, targetRow);
  if (sourceElement.length && targetElement.length) {
    targetElement[0].className = sourceElement[0].className;
  }
};

Drupal.tableDrag.prototype.checkScroll = function(cursorY) {
  var de  = document.documentElement;
  var b  = document.body;

  var windowHeight = this.windowHeight = window.innerHeight || (de.clientHeight && de.clientWidth != 0 ? de.clientHeight : b.offsetHeight);
  var scrollY = this.scrollY = (document.all ? (!de.scrollTop ? b.scrollTop : de.scrollTop) : (window.pageYOffset ? window.pageYOffset : window.scrollY));
  var trigger = this.scrollSettings.trigger;
  var delta = 0;

  if (cursorY - scrollY > windowHeight - trigger) {
    delta = trigger / (windowHeight + scrollY - cursorY);
    delta = (delta > 0 && delta < trigger) ? delta : trigger;
    return delta * this.scrollSettings.amount;
  }
  else if (cursorY - scrollY < trigger) {
    delta = trigger / (cursorY - scrollY);
    delta = (delta > 0 && delta < trigger) ? delta : trigger;
    return -delta * this.scrollSettings.amount;
  }
};

Drupal.tableDrag.prototype.setScroll = function(scrollAmount) {
  var self = this;

  this.scrollInterval = setInterval(function() {
    self.checkScroll(self.currentMouseCoords.y);
    var aboveTable = self.scrollY > self.table.topY;
    var belowTable = self.scrollY + self.windowHeight < self.table.bottomY;
    if (scrollAmount > 0 && belowTable || scrollAmount < 0 && aboveTable) {
      window.scrollBy(0, scrollAmount);
    }
  }, this.scrollSettings.interval);
};

Drupal.tableDrag.prototype.restripeTable = function() {
  $('tr.draggable', this.table)
    .filter(':odd').filter('.odd')
      .removeClass('odd').addClass('even')
    .end().end()
    .filter(':even').filter('.even')
      .removeClass('even').addClass('odd');
};

Drupal.tableDrag.prototype.onDrag = function() {
  return null;
};

Drupal.tableDrag.prototype.onDrop = function() {
  return null;
};

Drupal.tableDrag.prototype.row = function(tableRow, method, indentEnabled, maxDepth, addClasses) {
  this.element = tableRow;
  this.method = method;
  this.group = new Array(tableRow);
  this.groupDepth = $('.indentation', tableRow).size();
  this.changed = false;
  this.table = $(tableRow).parents('table:first').get(0);
  this.indentEnabled = indentEnabled;
  this.maxDepth = maxDepth;
  this.direction = ''; // Direction the row is being moved.

  if (this.indentEnabled) {
    this.indents = $('.indentation', tableRow).size();
    this.children = this.findChildren(addClasses);
    this.group = $.merge(this.group, this.children);
    for (var n = 0; n < this.group.length; n++) {
      this.groupDepth = Math.max($('.indentation', this.group[n]).size(), this.groupDepth);
    }
  }
};

Drupal.tableDrag.prototype.row.prototype.findChildren = function(addClasses) {
  var parentIndentation = this.indents;
  var currentRow = $(this.element, this.table).next('tr.draggable');
  var rows = new Array();
  var child = 0;
  while (currentRow.length) {
    var rowIndentation = $('.indentation', currentRow).length;
    if (rowIndentation > parentIndentation) {
      child++;
      rows.push(currentRow[0]);
      if (addClasses) {
        $('.indentation', currentRow).each(function(indentNum) {
          if (child == 1 && (indentNum == parentIndentation)) {
            $(this).addClass('tree-child-first');
          }
          if (indentNum == parentIndentation) {
            $(this).addClass('tree-child');
          }
          else if (indentNum > parentIndentation) {
            $(this).addClass('tree-child-horizontal');
          }
        });
      }
    }
    else {
      break;
    }
    currentRow = currentRow.next('tr.draggable');
  }
  if (addClasses && rows.length) {
    $('.indentation:nth-child(' + (parentIndentation + 1) + ')', rows[rows.length - 1]).addClass('tree-child-last');
  }
  return rows;
};

Drupal.tableDrag.prototype.row.prototype.isValidSwap = function(row) {
  if (this.indentEnabled) {
    var prevRow, nextRow;
    if (this.direction == 'down') {
      prevRow = row;
      nextRow = $(row).next('tr').get(0);
    }
    else {
      prevRow = $(row).prev('tr').get(0);
      nextRow = row;
    }
    this.interval = this.validIndentInterval(prevRow, nextRow);

    if (this.interval.min > this.interval.max) {
      return false;
    }
  }

  if (this.table.tBodies[0].rows[0] == row && $(row).is(':not(.draggable)')) {
    return false;
  }

  return true;
};

Drupal.tableDrag.prototype.row.prototype.swap = function(position, row) {
  $(row)[position](this.group);
  this.changed = true;
  this.onSwap(row);
};

Drupal.tableDrag.prototype.row.prototype.validIndentInterval = function (prevRow, nextRow) {
  var minIndent, maxIndent;
  minIndent = nextRow ? $('.indentation', nextRow).size() : 0;
  if (!prevRow || $(this.element).is('.tabledrag-root')) {
    maxIndent = 0;
  }
  else {
    maxIndent = $('.indentation', prevRow).size() + ($(prevRow).is('.tabledrag-leaf') ? 0 : 1);
    if (this.maxDepth) {
      maxIndent = Math.min(maxIndent, this.maxDepth - (this.groupDepth - this.indents));
    }
  }

  return {'min':minIndent, 'max':maxIndent};
}

Drupal.tableDrag.prototype.row.prototype.indent = function(indentDiff) {
  if (!this.interval) {
    prevRow = $(this.element).prev('tr').get(0);
    nextRow = $(this.group).filter(':last').next('tr').get(0);
    this.interval = this.validIndentInterval(prevRow, nextRow);
  }

  var indent = this.indents + indentDiff;
  indent = Math.max(indent, this.interval.min);
  indent = Math.min(indent, this.interval.max);
  indentDiff = indent - this.indents;

  for (var n = 1; n <= Math.abs(indentDiff); n++) {
    if (indentDiff < 0) {
      $('.indentation:first', this.group).remove();
      this.indents--;
    }
    else {
      $('td:first', this.group).prepend(Drupal.theme('tableDragIndentation'));
      this.indents++;
    }
  }
  if (indentDiff) {
    this.changed = true;
    this.groupDepth += indentDiff;
    this.onIndent();
  }

  return indentDiff;
};

Drupal.tableDrag.prototype.row.prototype.findSiblings = function(rowSettings) {
  var siblings = new Array();
  var directions = new Array('prev', 'next');
  var rowIndentation = this.indents;
  for (var d in directions) {
	  //joomla/mootools no likee?
    //var checkRow = $(this.element)[directions[d]]();
	 if (directions[d] == 'prev') {
    	var checkRow = $(this.element).prev();
	 } else if  (directions[d] == 'next') {
    	var checkRow = $(this.element).next();
	 }
    while (checkRow.length) {
      if ($('.' + rowSettings.target, checkRow)) {
        if (this.indentEnabled) {
          var checkRowIndentation = $('.indentation', checkRow).length
        }

        if (!(this.indentEnabled) || (checkRowIndentation == rowIndentation)) {
          siblings.push(checkRow[0]);
        }
        else if (checkRowIndentation < rowIndentation) {
          break;
        }
      }
      else {
        break;
      }
      checkRow = $(checkRow)[directions[d]]();
    }
    if (directions[d] == 'prev') {
      siblings.reverse();
      siblings.push(this.element);
    }
  }
  return siblings;
};

Drupal.tableDrag.prototype.row.prototype.removeIndentClasses = function() {
  for (var n in this.children) {
    $('.indentation', $(this).children[n])
      .removeClass('tree-child')
      .removeClass('tree-child-first')
      .removeClass('tree-child-last')
      .removeClass('tree-child-horizontal');
  }
};

Drupal.tableDrag.prototype.row.prototype.markChanged = function() {
  var marker = Drupal.theme('tableDragChangedMarker');
  var cell = $('td:first', this.element);
  if ($('span.tabledrag-changed', cell).length == 0) {
    cell.append(marker);
  }
};

Drupal.tableDrag.prototype.row.prototype.onIndent = function() {
  return null;
};

Drupal.tableDrag.prototype.row.prototype.onSwap = function(swappedRow) {
  return null;
};

Drupal.theme.prototype.tableDragChangedMarker = function () {
  return '<span class="warning tabledrag-changed">*</span>';
};

Drupal.theme.prototype.tableDragIndentation = function () {
  return '<div class="indentation">&nbsp;</div>';
};

Drupal.theme.prototype.tableDragChangedWarning = function () {
  return '<div class="warning">' + Drupal.theme('tableDragChangedMarker') + ' ' + Drupal.t("Changes made in this table will not be saved until the form is submitted.") + '</div>';
};

})(jQuery);
