/*global jQuery, Handlebars, Router */
jQuery(function ($) {
	'use strict';

	Handlebars.registerHelper('eq', function (a, b, options) {
		return a === b ? options.fn(this) : options.inverse(this);
	});

	var ENTER_KEY = 13;
	var ESCAPE_KEY = 27;

	var util = {
		pluralize: function (count, word) {
			return count === 1 ? word : word + 's';
		},
		store: function (namespace, data) {
			if (arguments.length > 1) {
				return localStorage.setItem(namespace, JSON.stringify(data));
			} else {
				var store = localStorage.getItem(namespace);
				return (store && JSON.parse(store)) || [];
			}
		}
	};


	// The todoData object purely handles data management and storage for the todo list
	var todoData = {
		list: [],
		initialize: function() {
			// Populate list with localStorage data, if any exists
			this.list = util.store('todos-jquery');
			if (this.list === undefined) {
				this.list = [];
			}
		},
		createTodo: function(todoTitle) {
			// Add a new todo object to this.list
			this.list.push({
				// Note: the id property contains the list index of this todo object, and is also designed to serve as a unique DOM element ID
				id: todoData.listIndexToDomId(todoData.list.length),
				title: todoTitle,
				completed: false
			});
			util.store('todos-jquery', this.list);
		},
		destroyTodo: function(todoDomId) {
			var todoListIndex = this.domIDToListIndex(todoDomId);
			this.list.splice(todoListIndex, 1);
			this.putTodoIdsInOrder();
			util.store('todos-jquery', this.list);
		},
		toggleTodo: function(todoDomId) {
			var todoListIndex = this.domIDToListIndex(todoDomId);
			this.list[todoListIndex].completed = !this.list[todoListIndex].completed;
			util.store('todos-jquery', this.list);
		},
		// Sets all todos to be complete or incomplete
		setCompletenessOfAllTodos: function(isComplete) {
			this.list.forEach(function(todo) {
				todo.completed = isComplete;
			});
			util.store('todos-jquery', this.list);
		},
		destroyCompletedTodos: function() {
			this.list = this.list.filter(function(todo) {
				return !todo.completed;
			});
			this.putTodoIdsInOrder();
			util.store('todos-jquery', this.list);
		},
		updateTodoTitle(todoDomId, newTitle) {
			var todoListIndex = this.domIDToListIndex(todoDomId);
			this.list[todoListIndex].title = newTitle;
			util.store('todos-jquery', this.list);
		},

		// The following two internal methods convert between an integer index usable by this.list
		//   and a unique string ID usable as an element ID in the DOM
		listIndexToDomId: function(listIndex) {
			return 'todo' + listIndex;
		},
		domIDToListIndex: function(domId) {
			return parseInt(domId.substr('todo'.length));
		},
		// Internal method for putting IDs back in order after having deleted some todos
		putTodoIdsInOrder: function() {
			for (var i = 0; i < this.list.length; i++) {
				this.list[i].id = this.listIndexToDomId(i);
			}
		}

	};
	// End definition of todoData object




	var App = {
		init: function () {
			todoData.initialize();  // Changed for Beast 2
			this.todoTemplate = Handlebars.compile($('#todo-template').html());
			this.footerTemplate = Handlebars.compile($('#footer-template').html());
			this.bindEvents();

			new Router({
				'/:filter': function (filter) {
					this.filter = filter;
					this.render();
				}.bind(this)
			}).init('/all');
		},


		bindEvents: function () {
			$('#new-todo').on('keyup', (function(e) {
					// If user pressed enter with a non-empty input text, create a new todo
					var $input = $(e.target);
					var val = $input.val().trim();
					if (e.which === ENTER_KEY && val) {
						todoData.createTodo(val);
						$input.val('');
						this.render();
					}
				}).bind(this));
			$('#toggle-all').on('change', (function(e) {
					// Use the checked-ness of the toggle-all checkbox to set the checked-ness of all todos
					var isChecked = $(e.target).prop('checked');
					todoData.setCompletenessOfAllTodos(isChecked);
					this.render();
				}).bind(this));
			$('#footer').on('click', '#clear-completed', (function() {
					todoData.destroyCompletedTodos();
					this.filter = 'all';
					this.render();
				}).bind(this));

			$('#todo-list')
				.on('change', '.toggle', (function(e) {
						// User clicked the checkbox next to a todo, so toggle its checked-ness
						var liDomId = $(e.target).closest('li').prop('id');
						todoData.toggleTodo(liDomId);
						this.render();
					}).bind(this))
				.on('dblclick', 'label', (function(e) {
						// User double-clicked a todo; open it up for editing
						var $closestLi = $(e.target).closest('li');
						$closestLi.addClass('editing');
						$closestLi.find('.edit').focus();  // Focus on the todo-editing text input box
						// No data has changed yet, so no this.render() required

						// Below are the original lines of this code... I think my version above is equivalent and clearer?
						// var $input = $(e.target).closest('li').addClass('editing').find('.edit');
						// $input.val($input.val()).focus();
					}).bind(this))
				.on('keyup', '.edit', (function(e) {
						// This event is triggered when user types in the todo-editing text box
						// If user pressed enter, blur the focus (will trigger this.update())
						if (e.which === ENTER_KEY) {
							e.target.blur();
						}
						// If user pressed escape, blur the focus (without saving changes)
						else if (e.which === ESCAPE_KEY) {
							$(e.target).data('abort', true).blur();
						}
					}).bind(this))
				.on('focusout', '.edit', (function(e) {
						var $el = $(e.target);
						var todoDomId = $el.closest('li').prop('id');

						if ($el.val() === '') {
							todoData.destroyTodo(todoDomId);
						}
						else if ($el.data('abort')) {
							$el.data('abort', false);
						} else {
							todoData.updateTodoTitle(todoDomId, $el.val());
						}
			
						this.render();
					}).bind(this))
				.on('click', '.destroy', (function(e) {
						todoData.destroyTodo($(e.target).closest('li').prop('id'));
						this.render();
					}).bind(this));

		},
		// End bindEvents function definition
		

		render: function () {
			var activeTodos = todoData.list.filter(function(todo) { return !todo.completed; });
			var todos;
			if (this.filter === 'active') {
				todos = activeTodos;
			} else if (this.filter === 'completed') {
				todos = todoData.list.filter(function(todo) { return todo.completed; });
			} else {
				todos = todoData.list;
			}
			$('#todo-list').html(this.todoTemplate(todos));
			$('#main').toggle(todos.length > 0);
			$('#toggle-all').prop('checked', activeTodos.length === 0);
			this.renderFooter(todos.length, activeTodos.length);
			$('#new-todo').focus();
		},
		renderFooter: function (todoCount, activeTodoCount) {
			var template = this.footerTemplate({
				activeTodoCount: activeTodoCount,
				activeTodoWord: util.pluralize(activeTodoCount, 'item'),
				completedTodos: todoCount - activeTodoCount,
				filter: this.filter
			});

			$('#footer').toggle(todoCount > 0).html(template);
		},

	};
	// End definition of App object





	App.init();
});
