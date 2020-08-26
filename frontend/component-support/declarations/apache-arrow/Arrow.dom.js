"use strict"
// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
Object.defineProperty(exports, "__esModule", { value: true })
const adapters_1 = require("./io/adapters")
const index_1 = require("./builder/index")
const reader_1 = require("./ipc/reader")
const writer_1 = require("./ipc/writer")
const iterable_1 = require("./io/whatwg/iterable")
const builder_1 = require("./io/whatwg/builder")
const reader_2 = require("./io/whatwg/reader")
const writer_2 = require("./io/whatwg/writer")
adapters_1.default.toDOMStream = iterable_1.toDOMStream
index_1.Builder["throughDOM"] = builder_1.builderThroughDOMStream
reader_1.RecordBatchReader["throughDOM"] =
  reader_2.recordBatchReaderThroughDOMStream
writer_1.RecordBatchWriter["throughDOM"] =
  writer_2.recordBatchWriterThroughDOMStream
var Arrow_1 = require("./Arrow")
exports.ArrowType = Arrow_1.ArrowType
exports.DateUnit = Arrow_1.DateUnit
exports.IntervalUnit = Arrow_1.IntervalUnit
exports.MessageHeader = Arrow_1.MessageHeader
exports.MetadataVersion = Arrow_1.MetadataVersion
exports.Precision = Arrow_1.Precision
exports.TimeUnit = Arrow_1.TimeUnit
exports.Type = Arrow_1.Type
exports.UnionMode = Arrow_1.UnionMode
exports.BufferType = Arrow_1.BufferType
exports.Data = Arrow_1.Data
exports.DataType = Arrow_1.DataType
exports.Null = Arrow_1.Null
exports.Bool = Arrow_1.Bool
exports.Int = Arrow_1.Int
exports.Int8 = Arrow_1.Int8
exports.Int16 = Arrow_1.Int16
exports.Int32 = Arrow_1.Int32
exports.Int64 = Arrow_1.Int64
exports.Uint8 = Arrow_1.Uint8
exports.Uint16 = Arrow_1.Uint16
exports.Uint32 = Arrow_1.Uint32
exports.Uint64 = Arrow_1.Uint64
exports.Float = Arrow_1.Float
exports.Float16 = Arrow_1.Float16
exports.Float32 = Arrow_1.Float32
exports.Float64 = Arrow_1.Float64
exports.Utf8 = Arrow_1.Utf8
exports.Binary = Arrow_1.Binary
exports.FixedSizeBinary = Arrow_1.FixedSizeBinary
exports.Date_ = Arrow_1.Date_
exports.DateDay = Arrow_1.DateDay
exports.DateMillisecond = Arrow_1.DateMillisecond
exports.Timestamp = Arrow_1.Timestamp
exports.TimestampSecond = Arrow_1.TimestampSecond
exports.TimestampMillisecond = Arrow_1.TimestampMillisecond
exports.TimestampMicrosecond = Arrow_1.TimestampMicrosecond
exports.TimestampNanosecond = Arrow_1.TimestampNanosecond
exports.Time = Arrow_1.Time
exports.TimeSecond = Arrow_1.TimeSecond
exports.TimeMillisecond = Arrow_1.TimeMillisecond
exports.TimeMicrosecond = Arrow_1.TimeMicrosecond
exports.TimeNanosecond = Arrow_1.TimeNanosecond
exports.Decimal = Arrow_1.Decimal
exports.List = Arrow_1.List
exports.Struct = Arrow_1.Struct
exports.Union = Arrow_1.Union
exports.DenseUnion = Arrow_1.DenseUnion
exports.SparseUnion = Arrow_1.SparseUnion
exports.Dictionary = Arrow_1.Dictionary
exports.Interval = Arrow_1.Interval
exports.IntervalDayTime = Arrow_1.IntervalDayTime
exports.IntervalYearMonth = Arrow_1.IntervalYearMonth
exports.FixedSizeList = Arrow_1.FixedSizeList
exports.Map_ = Arrow_1.Map_
exports.Table = Arrow_1.Table
exports.Column = Arrow_1.Column
exports.Schema = Arrow_1.Schema
exports.Field = Arrow_1.Field
exports.Visitor = Arrow_1.Visitor
exports.Vector = Arrow_1.Vector
exports.BaseVector = Arrow_1.BaseVector
exports.BinaryVector = Arrow_1.BinaryVector
exports.BoolVector = Arrow_1.BoolVector
exports.Chunked = Arrow_1.Chunked
exports.DateVector = Arrow_1.DateVector
exports.DateDayVector = Arrow_1.DateDayVector
exports.DateMillisecondVector = Arrow_1.DateMillisecondVector
exports.DecimalVector = Arrow_1.DecimalVector
exports.DictionaryVector = Arrow_1.DictionaryVector
exports.FixedSizeBinaryVector = Arrow_1.FixedSizeBinaryVector
exports.FixedSizeListVector = Arrow_1.FixedSizeListVector
exports.FloatVector = Arrow_1.FloatVector
exports.Float16Vector = Arrow_1.Float16Vector
exports.Float32Vector = Arrow_1.Float32Vector
exports.Float64Vector = Arrow_1.Float64Vector
exports.IntervalVector = Arrow_1.IntervalVector
exports.IntervalDayTimeVector = Arrow_1.IntervalDayTimeVector
exports.IntervalYearMonthVector = Arrow_1.IntervalYearMonthVector
exports.IntVector = Arrow_1.IntVector
exports.Int8Vector = Arrow_1.Int8Vector
exports.Int16Vector = Arrow_1.Int16Vector
exports.Int32Vector = Arrow_1.Int32Vector
exports.Int64Vector = Arrow_1.Int64Vector
exports.Uint8Vector = Arrow_1.Uint8Vector
exports.Uint16Vector = Arrow_1.Uint16Vector
exports.Uint32Vector = Arrow_1.Uint32Vector
exports.Uint64Vector = Arrow_1.Uint64Vector
exports.ListVector = Arrow_1.ListVector
exports.MapVector = Arrow_1.MapVector
exports.NullVector = Arrow_1.NullVector
exports.StructVector = Arrow_1.StructVector
exports.TimestampVector = Arrow_1.TimestampVector
exports.TimestampSecondVector = Arrow_1.TimestampSecondVector
exports.TimestampMillisecondVector = Arrow_1.TimestampMillisecondVector
exports.TimestampMicrosecondVector = Arrow_1.TimestampMicrosecondVector
exports.TimestampNanosecondVector = Arrow_1.TimestampNanosecondVector
exports.TimeVector = Arrow_1.TimeVector
exports.TimeSecondVector = Arrow_1.TimeSecondVector
exports.TimeMillisecondVector = Arrow_1.TimeMillisecondVector
exports.TimeMicrosecondVector = Arrow_1.TimeMicrosecondVector
exports.TimeNanosecondVector = Arrow_1.TimeNanosecondVector
exports.UnionVector = Arrow_1.UnionVector
exports.DenseUnionVector = Arrow_1.DenseUnionVector
exports.SparseUnionVector = Arrow_1.SparseUnionVector
exports.Utf8Vector = Arrow_1.Utf8Vector
exports.ByteStream = Arrow_1.ByteStream
exports.AsyncByteStream = Arrow_1.AsyncByteStream
exports.AsyncByteQueue = Arrow_1.AsyncByteQueue
exports.RecordBatchReader = Arrow_1.RecordBatchReader
exports.RecordBatchFileReader = Arrow_1.RecordBatchFileReader
exports.RecordBatchStreamReader = Arrow_1.RecordBatchStreamReader
exports.AsyncRecordBatchFileReader = Arrow_1.AsyncRecordBatchFileReader
exports.AsyncRecordBatchStreamReader = Arrow_1.AsyncRecordBatchStreamReader
exports.RecordBatchWriter = Arrow_1.RecordBatchWriter
exports.RecordBatchFileWriter = Arrow_1.RecordBatchFileWriter
exports.RecordBatchStreamWriter = Arrow_1.RecordBatchStreamWriter
exports.RecordBatchJSONWriter = Arrow_1.RecordBatchJSONWriter
exports.MessageReader = Arrow_1.MessageReader
exports.AsyncMessageReader = Arrow_1.AsyncMessageReader
exports.JSONMessageReader = Arrow_1.JSONMessageReader
exports.Message = Arrow_1.Message
exports.RecordBatch = Arrow_1.RecordBatch
exports.DataFrame = Arrow_1.DataFrame
exports.FilteredDataFrame = Arrow_1.FilteredDataFrame
exports.CountByResult = Arrow_1.CountByResult
exports.predicate = Arrow_1.predicate
exports.util = Arrow_1.util
exports.Builder = Arrow_1.Builder
exports.BinaryBuilder = Arrow_1.BinaryBuilder
exports.BoolBuilder = Arrow_1.BoolBuilder
exports.DateBuilder = Arrow_1.DateBuilder
exports.DateDayBuilder = Arrow_1.DateDayBuilder
exports.DateMillisecondBuilder = Arrow_1.DateMillisecondBuilder
exports.DecimalBuilder = Arrow_1.DecimalBuilder
exports.DictionaryBuilder = Arrow_1.DictionaryBuilder
exports.FixedSizeBinaryBuilder = Arrow_1.FixedSizeBinaryBuilder
exports.FixedSizeListBuilder = Arrow_1.FixedSizeListBuilder
exports.FloatBuilder = Arrow_1.FloatBuilder
exports.Float16Builder = Arrow_1.Float16Builder
exports.Float32Builder = Arrow_1.Float32Builder
exports.Float64Builder = Arrow_1.Float64Builder
exports.IntervalBuilder = Arrow_1.IntervalBuilder
exports.IntervalDayTimeBuilder = Arrow_1.IntervalDayTimeBuilder
exports.IntervalYearMonthBuilder = Arrow_1.IntervalYearMonthBuilder
exports.IntBuilder = Arrow_1.IntBuilder
exports.Int8Builder = Arrow_1.Int8Builder
exports.Int16Builder = Arrow_1.Int16Builder
exports.Int32Builder = Arrow_1.Int32Builder
exports.Int64Builder = Arrow_1.Int64Builder
exports.Uint8Builder = Arrow_1.Uint8Builder
exports.Uint16Builder = Arrow_1.Uint16Builder
exports.Uint32Builder = Arrow_1.Uint32Builder
exports.Uint64Builder = Arrow_1.Uint64Builder
exports.ListBuilder = Arrow_1.ListBuilder
exports.MapBuilder = Arrow_1.MapBuilder
exports.NullBuilder = Arrow_1.NullBuilder
exports.StructBuilder = Arrow_1.StructBuilder
exports.TimestampBuilder = Arrow_1.TimestampBuilder
exports.TimestampSecondBuilder = Arrow_1.TimestampSecondBuilder
exports.TimestampMillisecondBuilder = Arrow_1.TimestampMillisecondBuilder
exports.TimestampMicrosecondBuilder = Arrow_1.TimestampMicrosecondBuilder
exports.TimestampNanosecondBuilder = Arrow_1.TimestampNanosecondBuilder
exports.TimeBuilder = Arrow_1.TimeBuilder
exports.TimeSecondBuilder = Arrow_1.TimeSecondBuilder
exports.TimeMillisecondBuilder = Arrow_1.TimeMillisecondBuilder
exports.TimeMicrosecondBuilder = Arrow_1.TimeMicrosecondBuilder
exports.TimeNanosecondBuilder = Arrow_1.TimeNanosecondBuilder
exports.UnionBuilder = Arrow_1.UnionBuilder
exports.DenseUnionBuilder = Arrow_1.DenseUnionBuilder
exports.SparseUnionBuilder = Arrow_1.SparseUnionBuilder
exports.Utf8Builder = Arrow_1.Utf8Builder

//# sourceMappingURL=Arrow.dom.js.map
