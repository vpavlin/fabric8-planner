import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { Logger } from 'ngx-base';

import { IMyOptions, IMyDateModel } from 'mydatepicker';

import { WorkItem } from '../../../models/work-item';

export class DynamicUpdateEvent {
  form: FormGroup;
  formControlName: string;
  newValue: any;
  oldValue: any;
  attributeDesc: any;
}

/*
 * NOTE: this control is not using the FormGroup "properly", like with 
 * a formControlName as an Input(). This is due to some components having
 * problems with that (namely the Datepicker). We may want to revisit this
 * later.
 */

/*
 *  This class represents one single dynamic data field. It uses the
 *  Angular form facilities to create a form group and display the 
 *  control. If new data types should be supported, add them to this
 *  component.
 */
@Component({
  selector: 'alm-dynamic-field',
  templateUrl: './dynamic-field.component.html',
  styleUrls: ['./dynamic-field.component.scss']
})
export class DynamicFieldComponent implements OnInit {

  // this is the type schema taken from the work item type.
  @Input() attributeDesc: any;

  // the created FormControl group for the above.
  @Input() form: FormGroup;

  // event when value is updated, emits new value as the event.
  @Output() onUpdate = new EventEmitter();

  // the attribute key we're dealing with.
  attributeKey: string;

  // pristine old value that is needed for the cancel operation.
  oldValue: any;

  // the date value of the control (the datepicker works with a different data type).
  dateValue: any;

  error: string;
  buttonsVisible: boolean = false;

  datePickerOptions: IMyOptions = {
    dateFormat: 'dd mmm yyyy',
    selectionTxtFontSize: '14px',
    openSelectorOnInputClick: true,
    editableDateField: false,
    showClearDateBtn: false,
    componentDisabled: false
  };

  constructor(
    protected logger: Logger
  ) {}

  ngOnInit(): void {
    // get the attribute key from the descriptor
    this.attributeKey = this.attributeDesc.key;
    // store the pristine value.
    this.oldValue = this.form.value[this.attributeKey];
    // if this is a datepicker, we need to convert the data type.
    if (this.attributeDesc.type.kind === 'instant') {
      // the datepicker we use does not support calling functions from the model attribute.
      this.dateValue = this.toDateModel(this.form.value[this.attributeKey]);
    }
    // we don't need to listen for @Input changes to the work item, because the form will
    // be re-created from the schema on every load of a work item in the parent detail view.
    // BUT: if we want to use this component on other dialogs that may not be re-created,
    // we might need to listen to changes using OnChanges().
  }

  isValid() { 
    return this.form.controls[this.attributeKey].valid; 
  }

  isButtonsVisible() { 
    return this.buttonsVisible; 
  }

  focusIn() {
    this.buttonsVisible = true;
  }
  
  onChangeDropdown(newOption: string) {
    if (newOption == '&nbsp;')
      this.form.patchValue(this.toUpdateObject(this.attributeKey, ''));
    else
      this.form.patchValue(this.toUpdateObject(this.attributeKey, newOption));
    this.save();
  }

  getBooleanText(booleanValue: boolean): string {
    if (typeof booleanValue != 'boolean')
      return '&nbsp;';
    else if (booleanValue)
      return 'Yes';
    else
      return 'No';
  }

  onChangeBoolean(newOption: boolean) {
    if (newOption == null)
      this.form.patchValue(this.toUpdateObject(this.attributeKey, undefined));
    else
      this.form.patchValue(this.toUpdateObject(this.attributeKey, newOption));
    this.save();
  }

  onChangeMarkup(newMarkupValue: string) {
    if (newMarkupValue)
      this.form.patchValue(this.toUpdateObject(this.attributeKey, newMarkupValue));
    this.save();
  }

  onDateChanged(newDate: IMyDateModel) {
    let date = newDate.jsdate.toISOString();
    this.form.patchValue(this.toUpdateObject(this.attributeKey, date));
    this.save();
  }

  toDateModel(dateValue: string): any {
    if (!dateValue)
      return undefined;
    else {
      let date: Date = new Date(dateValue);
      let convertedDate = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() } ;
      return convertedDate;      
    }
  }

  baseChangeBaseType(newValue: string) {
    this.form.patchValue(this.toUpdateObject(this.attributeKey, newValue));
  }

  toUpdateObject(key: string, value: any): any {
    let object = {};
    object[key] = value;
    return object;
  }

  save() {
    this.buttonsVisible = false;
    try {
      // based on the data type, we're converting the data before storing it.
      if (this.attributeDesc.type.kind === 'integer') {
        let number: number = parseInt(this.form.value[this.attributeKey]);
        if (isNaN(number))
          throw('invalid data for field - not an integer');
        else 
          this.form.patchValue(this.toUpdateObject(this.attributeKey, number));
      } else if (this.attributeDesc.type.kind === 'float') {
        let number: number = parseFloat(this.form.value[this.attributeKey]);
        if (isNaN(number))
          throw('invalid data for field - not a float');
        else
          this.form.patchValue(this.toUpdateObject(this.attributeKey, number));
      } else if (this.attributeDesc.type.kind === 'enum') {
        let value = this.form.value[this.attributeKey];
        if (this.attributeDesc.type.values.indexOf(value) == -1)
          throw('invalid data for field - not in valid values');
        else
          this.form.patchValue(this.toUpdateObject(this.attributeKey, value));
      } // no else needed, the value is already in the form data structure.
      this.error = null;
    } catch (error) {
      this.error = error;
    }
    // emit onUpdate event    
    if (this.onUpdate) {
      let newValue, oldValue;
      if (this.attributeDesc.type.kind === 'markup') {
        // if we're dealing with marup, we need to encapsulate the values.
        newValue = { markup: 'Markdown', content: this.form.value[this.attributeKey] };
        oldValue = { markup: 'Markdown', content: this.oldValue };
      } else {
        // all other data types are delivered normalized.
        newValue = this.form.value[this.attributeKey];
        oldValue = this.oldValue;
      }
      let updateEvent = {
        form: this.form,
        formControlName: this.attributeKey,
        newValue: newValue,
        oldValue: oldValue,
        attributeDesc: this.attributeDesc
      } as DynamicUpdateEvent;
      this.logger.log('Emit dynamic form control update for key ' + this.attributeKey);
      this.onUpdate.emit(updateEvent);
    };
    // update the oldValue
    this.oldValue = this.form.value[this.attributeKey];
  }

  cancel() {
    // setting the form value to the (old) data value and mark it as pristine
    this.form.controls[this.attributeKey].patchValue(this.oldValue);
    this.form.controls[this.attributeKey].markAsPristine();
  }
}
